import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "@/app/api/leaderboard/route";
import { GET as getEligibility } from "@/app/api/runs/[id]/leaderboard-eligibility/route";
import { POST as postClaim } from "@/app/api/runs/[id]/leaderboard-entry/route";
import * as schema from "@/server/db/schema";
import { newRun } from "@/server/game/engine";
import { bootstrap, findSession } from "@/server/game/service";
import { readLeaderboard } from "@/server/leaderboard/pagination";
import { limitLeaderboard } from "@/server/leaderboard/rate-limit";
import { claimEntry, readEligibility } from "@/server/leaderboard/service";

let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
const url = process.env.TEST_DATABASE_URL;
const schemaName = `ranking_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let pool: Pool;
const ownerId = randomUUID();
const otherId = randomUUID();
const template = newRun(randomUUID(), ownerId);
function finished(ore = 100, owner: string = ownerId) {
  const run = structuredClone(template);
  run.id = randomUUID();
  run.ownerId = owner;
  run.status = "finished";
  run.game.finishedAt = "2026-01-01T12:00:00.000Z";
  run.game.state.lockpicks = 0;
  run.game.state.currentLock.isFailed = true;
  run.game.state.oreNuggets = ore;
  run.game.openedChests = 5;
  return run;
}
async function seedClaims(count: number) {
  if (!count) return [];
  const fixtures = Array.from({ length: count }, () => finished());
  await db.insert(schema.runs).values(fixtures);
  await db
    .insert(schema.leaderboardEntries)
    .values(fixtures.map((run) => ({ runId: run.id, nickname: "Wedge" })));
  return fixtures;
}
const query = (limit = 25, cursor?: string | null) =>
  new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });

describe.skipIf(!url)("durable public leaderboard PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${schemaName}`,
      max: 6,
    });
    db = drizzle(pool, { schema });
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pool.query(
        (await readFile(`drizzle/${entry.tag}.sql`, "utf8")).replaceAll(
          '"public".',
          `"${schemaName}".`,
        ),
      );
  });
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE sessions, runs, run_actions, leaderboard_entries, leaderboard_snapshots, leaderboard_request_budgets CASCADE",
    );
    await db.insert(schema.sessions).values(
      [ownerId, otherId].map((id) => ({
        id,
        tokenHash: id,
        expiresAt: new Date(Date.now() + 3600000),
      })),
    );
  });
  it("shares atomic budgets across adapters, bounds counts, isolates owners and resets expired windows", async () => {
    vi.stubEnv("LEADERBOARD_CLAIMS_PER_MINUTE", "2");
    try {
      const attempts = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          limitLeaderboard({ operation: "claim", ownerId }),
        ),
      );
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(2);
      for (const result of attempts) {
        if (result.status === "rejected") {
          expect(result.reason).toMatchObject({
            code: "RATE_LIMITED",
            status: 429,
            retryAfter: expect.any(Number),
          });
          expect(result.reason.retryAfter).toBeGreaterThanOrEqual(1);
          expect(result.reason.retryAfter).toBeLessThanOrEqual(60);
        }
      }
      db = drizzle(pool, { schema });
      await expect(
        limitLeaderboard({ operation: "claim", ownerId }),
      ).rejects.toMatchObject({ retryAfter: expect.any(Number) });
      await limitLeaderboard({ operation: "claim", ownerId: otherId });
      await limitLeaderboard({ operation: "eligibility", ownerId });
      const { rows } = await pool.query(
        "SELECT requests FROM leaderboard_request_budgets WHERE key=$1",
        [`claim:${ownerId}`],
      );
      expect(rows[0].requests).toBe(3);
      await pool.query(
        "UPDATE leaderboard_request_budgets SET expires_at=now()-interval '1 second'",
      );
      await limitLeaderboard({ operation: "claim", ownerId });
      const remaining = await pool.query(
        "SELECT key, requests FROM leaderboard_request_budgets",
      );
      expect(remaining.rows).toEqual([
        { key: `claim:${ownerId}`, requests: 1 },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("bounds anonymous snapshot creation independently of spoofed headers and cursor pages", async () => {
    vi.stubEnv("LEADERBOARD_SNAPSHOTS_PER_MINUTE", "1");
    vi.stubEnv("LEADERBOARD_PAGES_PER_MINUTE", "1");
    try {
      await seedClaims(30);
      const first = await GET(
        new Request("https://trial.test/api/leaderboard"),
      );
      expect(first.status).toBe(200);
      const { nextCursor } = await first.json();
      const blocked = await GET(
        new Request("https://trial.test/api/leaderboard", {
          headers: {
            "x-forwarded-for": "1.2.3.4",
            cookie: "wedges_session=forged",
          },
        }),
      );
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThanOrEqual(
        1,
      );
      expect(Number(blocked.headers.get("retry-after"))).toBeLessThanOrEqual(
        60,
      );
      expect(
        (await pool.query("SELECT count(*) FROM leaderboard_snapshots")).rows[0]
          .count,
      ).toBe("1");
      expect(
        (
          await GET(
            new Request(
              `https://trial.test/api/leaderboard?cursor=${nextCursor}`,
            ),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await GET(
            new Request(
              `https://trial.test/api/leaderboard?cursor=${nextCursor}`,
            ),
          )
        ).status,
      ).toBe(429);
      await pool.query(
        "UPDATE leaderboard_request_budgets SET expires_at=now()-interval '1 second'",
      );
      expect(
        (await GET(new Request("https://trial.test/api/leaderboard"))).status,
      ).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("preserves claim replay and immutable nickname after throttling, refresh and conflicting duplicates", async () => {
    vi.stubEnv("LEADERBOARD_CLAIMS_PER_MINUTE", "1");
    try {
      const { token } = await bootstrap(undefined);
      const owner = await findSession(token ?? undefined);
      if (!owner) throw new Error("Missing session");
      const run = finished(123, owner.id);
      await db.insert(schema.runs).values(run);
      const context = { params: Promise.resolve({ id: run.id }) };
      const input = { actionId: randomUUID(), nickname: "Клин" };
      const request = (body?: object) =>
        new NextRequest(
          `https://trial.test/api/runs/${run.id}/leaderboard-entry`,
          {
            method: body ? "POST" : "GET",
            headers: {
              origin: "https://trial.test",
              "content-type": "application/json",
              cookie: `wedges_session=${token}`,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
      const first = await postClaim(request(input), context);
      expect(first.status).toBe(200);
      const original = await first.json();
      expect(original.entry).toMatchObject({
        oreNuggets: 123,
        displayName: "Клин",
        rank: 1,
      });
      const blocked = await postClaim(request(input), context);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("cache-control")).toBe("no-store");
      const expire = () =>
        pool.query(
          "UPDATE leaderboard_request_budgets SET expires_at=now()-interval '1 second'",
        );
      await expire();
      db = drizzle(pool, { schema });
      expect(await (await postClaim(request(input), context)).json()).toEqual(
        original,
      );
      const qualification = await getEligibility(request(), context);
      expect(await qualification.json()).toEqual({
        eligible: false,
        reason: "already_claimed",
      });
      await expire();
      const conflict = await postClaim(
        request({ ...input, nickname: "Different" }),
        context,
      );
      expect(conflict.status).toBe(409);
      expect((await conflict.json()).error.code).toBe("ACTION_ID_REUSED");
      const publicResult = await (
        await GET(new Request("https://trial.test/api/leaderboard"))
      ).json();
      expect(publicResult.entries).toEqual([original.entry]);
      expect(JSON.stringify(publicResult)).not.toMatch(
        /ownerId|tokenHash|initialLock|optimalMoves|cursorKey/,
      );
      expect(
        (
          await pool.query(
            "SELECT count(*) FROM leaderboard_entries WHERE run_id=$1",
            [run.id],
          )
        ).rows[0].count,
      ).toBe("1");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await admin.end();
    }
  });
  it.each([0, 99, 100, 101, 999, 1000, 1001])(
    "returns bounded ranked runs with %i claims",
    async (count) => {
      const fixtures = await seedClaims(count);
      const unclaimed = finished(9999);
      const abandoned = finished(9999);
      abandoned.status = "abandoned";
      const active = structuredClone(template);
      active.id = randomUUID();
      const future = finished(9999);
      future.rulesetVersion = "future";
      await db
        .insert(schema.runs)
        .values([unclaimed, abandoned, active, future]);
      await db
        .insert(schema.leaderboardEntries)
        .values({ runId: future.id, nickname: "Future" });
      const entries = [];
      let cursor: string | null = null;
      do {
        const page = await readLeaderboard(query(100, cursor));
        entries.push(...page.entries);
        cursor = page.nextCursor;
      } while (cursor);
      expect(entries).toHaveLength(Math.min(count, 1000));
      expect(entries.map((e) => e.runId)).toEqual(
        fixtures
          .map((r) => r.id)
          .sort()
          .slice(0, 1000),
      );
      expect(entries.map((e) => e.rank)).toEqual(entries.map((_, i) => i + 1));
      for (const entry of entries)
        expect(Object.keys(entry).sort()).toEqual(
          [
            "rank",
            "runId",
            "displayName",
            "oreNuggets",
            "openedChests",
            "finishedAt",
          ].sort(),
        );
      expect(
        entries.every((e) => e.displayName === "Wedge" && e.oreNuggets === 100),
      ).toBe(true);
      const candidate = finished(0);
      await db.insert(schema.runs).values(candidate);
      expect((await readEligibility(ownerId, candidate.id)).eligible).toBe(
        count < 1000,
      );
    },
  );
  it("orders all tie breakers using server projections", async () => {
    const fixtures = [
      finished(200),
      finished(),
      finished(),
      finished(),
      finished(),
    ];
    fixtures[1].game.openedChests = 6;
    fixtures[2].game.finishedAt = "2026-01-01T13:00:01+01:00";
    fixtures[3].id = "00000000-0000-4000-8000-000000000001";
    fixtures[4].id = "00000000-0000-4000-8000-000000000002";
    await db.insert(schema.runs).values(fixtures);
    await db
      .insert(schema.leaderboardEntries)
      .values(fixtures.map((r) => ({ runId: r.id, nickname: "Same name" })));
    const result = await readLeaderboard(query());
    expect(result.entries.map((e) => e.runId)).toEqual(
      [0, 1, 3, 4, 2].map((i) => fixtures[i].id),
    );
  });
  it("freezes ranks across claims committed later with earlier timestamps, supports replay and changed page sizes", async () => {
    await seedClaims(101);
    const first = await readLeaderboard(query(25));
    const client = await pool.connect();
    const late = finished(9999);
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO runs (id,owner_id,version,status,ruleset_version,game) VALUES ($1,$2,1,'finished',$3,$4)",
        [late.id, ownerId, late.rulesetVersion, JSON.stringify(late.game)],
      );
      await client.query(
        "INSERT INTO leaderboard_entries(run_id,nickname,claimed_at) VALUES ($1,'Late','2020-01-01')",
        [late.id],
      );
      // Another function/process uses only durable rows, never an in-memory map.
      db = drizzle(pool, { schema });
      const second = await readLeaderboard(query(40, first.nextCursor));
      await client.query("COMMIT");
      expect(await readLeaderboard(query(40, first.nextCursor))).toEqual(
        second,
      );
      expect(second.entries.map((e) => e.rank)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 26),
      );
      expect(second.entries.some((e) => e.runId === late.id)).toBe(false);
      expect((await readLeaderboard(query())).entries[0].runId).toBe(late.id);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("rejects tampered, missing, expired and retired cursors over HTTP, then restarts", async () => {
    await seedClaims(30);
    const first = await readLeaderboard(query());
    if (!first.nextCursor) throw new Error("Missing cursor");
    const [id, offset, mac] = first.nextCursor.split(".");
    for (const cursor of [
      `${id}.26.${mac}`,
      `${id}.${offset}.${"0".repeat(64)}`,
      `${randomUUID()}.${offset}.${mac}`,
      `${"-".repeat(36)}.${offset}.${mac}`,
      "bad",
    ]) {
      const response = await GET(
        new Request(`https://trial.test/api/leaderboard?cursor=${cursor}`),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_CURSOR");
    }
    await pool.query(
      "UPDATE leaderboard_snapshots SET ruleset_version='retired' WHERE id=$1",
      [id],
    );
    await expect(readLeaderboard(query(25, first.nextCursor))).rejects.toThrow(
      "INVALID_CURSOR",
    );
    await pool.query(
      "UPDATE leaderboard_snapshots SET ruleset_version=$2,expires_at=now()-interval '1 second' WHERE id=$1",
      [id, template.rulesetVersion],
    );
    await expect(readLeaderboard(query(25, first.nextCursor))).rejects.toThrow(
      "INVALID_CURSOR",
    );
    const fresh = await GET(new Request("https://trial.test/api/leaderboard"));
    expect(fresh.status).toBe(200);
    expect((await fresh.json()).entries).toEqual(first.entries);
    expect(
      (
        await pool.query("SELECT id FROM leaderboard_snapshots WHERE id=$1", [
          id,
        ])
      ).rowCount,
    ).toBe(0);
  });
  it("rolls snapshot cleanup back when persistence fails", async () => {
    await seedClaims(30);
    await readLeaderboard(query());
    await pool.query(
      "UPDATE leaderboard_snapshots SET expires_at=now()-interval '1 second'",
    );
    await pool.query(
      `CREATE FUNCTION reject_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_snapshot BEFORE INSERT ON leaderboard_snapshots FOR EACH ROW EXECUTE FUNCTION reject_snapshot()`,
    );
    try {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(
        new Request("https://trial.test/api/leaderboard"),
      );
      expect(response.status).toBe(503);
      log.mockRestore();
      expect(
        (await pool.query("SELECT count(*) FROM leaderboard_snapshots")).rows[0]
          .count,
      ).toBe("1");
    } finally {
      await pool.query(
        "DROP TRIGGER reject_snapshot ON leaderboard_snapshots; DROP FUNCTION reject_snapshot()",
      );
    }
  });
  it("atomically rechecks tied cutoff races, replays and keeps multiple runs per owner", async () => {
    await seedClaims(999);
    const low = finished(0, ownerId);
    const high = finished(1, otherId);
    await db.insert(schema.runs).values([low, high]);
    expect(await readEligibility(ownerId, low.id)).toEqual({
      eligible: true,
      rank: 1000,
    });
    const input = { actionId: randomUUID(), nickname: "Wedge" };
    const accepted = await claimEntry(otherId, high.id, input);
    expect(await claimEntry(otherId, high.id, input)).toEqual(accepted);
    expect(
      (
        await claimEntry(ownerId, low.id, {
          actionId: randomUUID(),
          nickname: "Wedge",
        })
      ).body.outcome,
    ).toBe("leaderboard_not_qualified");
    const racers = [finished(2, ownerId), finished(2, otherId)];
    await db.insert(schema.runs).values(racers);
    await Promise.all(
      racers.map((r) =>
        claimEntry(r.ownerId, r.id, {
          actionId: randomUUID(),
          nickname: "Wedge",
        }),
      ),
    );
    const entries = [];
    let cursor: string | null = null;
    do {
      const result = await readLeaderboard(query(100, cursor));
      entries.push(...result.entries);
      cursor = result.nextCursor;
    } while (cursor);
    expect(entries.at(-1)?.runId).toBe(racers.map((r) => r.id).sort()[0]);
    expect(entries).toHaveLength(1000);
    expect(
      (
        await pool.query(
          "SELECT count(*) FROM leaderboard_entries WHERE run_id=$1",
          [high.id],
        )
      ).rows[0].count,
    ).toBe("1");
  });
});
