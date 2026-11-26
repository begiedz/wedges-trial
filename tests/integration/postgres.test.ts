import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
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
import type { SocketReply } from "@/api/realtime";
import { cleanupExpiredRuns } from "@/server/db/retention";
import * as schema from "@/server/db/schema";
import { newRun } from "@/server/game/engine";
import { handle } from "@/server/game/http";
import { executeMoveBatch } from "@/server/game/move-batch";
import { execute, readRun } from "@/server/game/service";
import { bootstrap, COOKIE_NAME, findSession } from "@/server/game/session";
import { bindGameSocket, type GameSocket } from "@/server/game/socket";
import { readTopRuns } from "@/server/leaderboard/read";
import { claimEntry, readEligibility } from "@/server/leaderboard/service";

let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
const url = process.env.TEST_DATABASE_URL;
const namespace = `game_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let pool: Pool;
let ownerId: string;
let otherId: string;
const command = (expectedVersion: number, direction: 1 | -1 = -1) => ({
  actionId: randomUUID(),
  expectedVersion,
  pinId: 0,
  direction,
});

/** One-plate boundary fixture makes damage, solving and credited rewards visible. */
async function game(picks = 1, now = new Date()) {
  const run = newRun(randomUUID(), ownerId, now);
  run.game.state.lockpicks = picks;
  run.game.state.currentLock = {
    pins: [{ id: 0, min: 0, max: 1, position: 0, target: 1 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 4,
    isSolved: false,
    isFailed: false,
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  await db.insert(schema.runs).values(run);
  return run;
}
async function stored(id: string) {
  return (await pool.query("SELECT * FROM runs WHERE id=$1", [id])).rows[0];
}
async function finish(run: Awaited<ReturnType<typeof game>>) {
  for (let i = 0; i < 4; i++)
    await execute(ownerId, "move", run.id, command(i + 1));
  const result = await readRun(ownerId, run.id);
  if (!result) throw new Error("Missing finished run");
  return result;
}

// All SQL goes to an explicitly supplied disposable database in a private schema.
describe.skipIf(!url)("minimal PostgreSQL gameplay persistence", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${namespace}"`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${namespace}`,
      max: 8,
    });
    db = drizzle(pool, { schema });
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries) {
      await pool.query(
        (await readFile(`drizzle/${entry.tag}.sql`, "utf8")).replaceAll(
          '"public".',
          `"${namespace}".`,
        ),
      );
    }
  });
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE sessions, runs, leaderboard_entries, global_game_stats CASCADE",
    );
    await db.insert(schema.globalGameStats).values({ id: 1 });
    ownerId = randomUUID();
    otherId = randomUUID();
    await db.insert(schema.sessions).values(
      [ownerId, otherId].map((id) => ({
        id,
        tokenHash: id,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      })),
    );
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
      await admin.end();
    }
  });

  it("has exactly four application tables", async () => {
    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",
      [namespace],
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      "global_game_stats",
      "leaderboard_entries",
      "runs",
      "sessions",
    ]);
  });

  it("uses hashed cookies, validates Origin/input and isolates private runs", async () => {
    const credentials = await bootstrap(undefined);
    const token = credentials.token;
    if (!token) throw new Error("Missing test credential");
    const owner = await findSession(token);
    if (!owner) throw new Error("Missing test owner");
    const created = await execute(owner.id, "create", undefined, {
      actionId: randomUUID(),
    });
    expect(owner.tokenHash).not.toBe(token);
    expect(await bootstrap(token)).toEqual({ token: null });
    await expect(readRun(otherId, created.body.run.id)).rejects.toMatchObject({
      code: "RUN_NOT_FOUND",
    });
    const post = (body: unknown, origin?: string, cookie = token) =>
      new NextRequest("https://trial.test/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${COOKIE_NAME}=${cookie}`,
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify(body),
      });
    expect(
      (await handle(post({ actionId: randomUUID() }), "create")).status,
    ).toBe(403);
    expect(
      (await handle(post({ score: 9000 }, "https://trial.test"), "create"))
        .status,
    ).toBe(400);
    expect(
      (
        await handle(
          post({ actionId: randomUUID() }, "https://trial.test", "invalid"),
          "create",
        )
      ).status,
    ).toBe(401);
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE id=$1", [
      owner.id,
    ]);
    expect(await findSession(token)).toBeNull();
    await expect(
      execute(owner.id, "move", created.body.run.id, command(1)),
    ).rejects.toMatchObject({ code: "SESSION_REQUIRED" });
  });

  it("reserves create identity without saving a response and never resurrects an expired create", async () => {
    const input = { actionId: randomUUID() };
    const [a, b] = await Promise.all([
      execute(ownerId, "create", undefined, input),
      execute(ownerId, "create", undefined, input),
    ]);
    expect(a.body.run.id).toBe(b.body.run.id);
    expect((await pool.query("SELECT id FROM runs")).rowCount).toBe(1);
    await expect(
      execute(ownerId, "create", undefined, { actionId: randomUUID() }),
    ).rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS" });
    const run = a.body.run;
    await pool.query(
      "UPDATE runs SET updated_at=now()-interval '8 days' WHERE id=$1",
      [run.id],
    );
    await cleanupExpiredRuns();
    await expect(
      execute(ownerId, "create", undefined, input),
    ).rejects.toMatchObject({ code: "RUN_NOT_FOUND" });
    const fresh = await execute(ownerId, "create", undefined, {
      actionId: randomUUID(),
    });
    expect(fresh.body.run.id).not.toBe(run.id);
    const owner = (
      await pool.query("SELECT creation_requests FROM sessions WHERE id=$1", [
        ownerId,
      ])
    ).rows[0];
    expect(Object.keys(owner.creation_requests)).toHaveLength(2);
  });

  it("serializes simultaneous moves and stores one current state without response history", async () => {
    const run = await game(3);
    const same = command(1);
    const results = await Promise.allSettled([
      execute(ownerId, "move", run.id, same),
      execute(ownerId, "move", run.id, same),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await stored(run.id)).version).toBe(2);
    await expect(execute(ownerId, "move", run.id, same)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    const reply = await executeMoveBatch(ownerId, run.id, [
      command(2),
      command(2),
      command(3),
    ]);
    expect(
      reply.map((r) => ("failure" in r ? r.failure.code : "accepted")),
    ).toEqual(["accepted", "VERSION_CONFLICT", "accepted"]);
    const current = await stored(run.id);
    expect(current.version).toBe(4);
    expect(current.game.totalMetrics.moves).toBe(3);
    expect(current.game.state.lockpicks).toBe(3);
    expect(current.game.state.currentLock.pins[0].position).toBe(0);
  });

  it("commits a socket burst and rejects an old retry without storing responses", async () => {
    const run = await game(3);
    const { WebSocketServer } = createRequire(import.meta.url)("ws");
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    server.on("connection", (socket: GameSocket) => {
      void bindGameSocket(
        socket,
        ownerId,
        run.id,
        new Date(Date.now() + 60000),
      );
    });
    const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    const replies: SocketReply[] = [];
    let changed = () => {};
    client.addEventListener("message", (event) => {
      replies.push(JSON.parse(String(event.data)));
      changed();
    });
    const received = async (count: number) => {
      if (replies.length >= count) return;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Missing socket reply")),
          5000,
        );
        changed = () => {
          if (replies.length >= count) {
            clearTimeout(timer);
            resolve();
          }
        };
        changed();
      });
    };
    try {
      await received(1);
      expect(replies[0].type).toBe("ready");
      const inputs = [command(1), command(2), command(3)];
      for (const body of inputs)
        client.send(
          JSON.stringify({
            type: "action",
            runId: run.id,
            action: "move",
            body,
          }),
        );
      await received(4);
      expect(replies.slice(1).map((reply) => reply.type)).toEqual([
        "result",
        "result",
        "result",
      ]);
      client.send(
        JSON.stringify({
          type: "action",
          runId: run.id,
          action: "move",
          body: inputs[0],
        }),
      );
      await received(5);
      expect(replies[4]).toMatchObject({
        type: "error",
        status: 409,
        error: { code: "VERSION_CONFLICT", currentVersion: 4 },
      });
      expect(
        (await readRun(ownerId, run.id))?.currentLock.invalidMovesOnCurrentPick,
      ).toBe(3);
    } finally {
      client.close();
      for (const socket of server.clients as Set<GameSocket>) socket.close();
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  it("carries partial pick damage and accumulated penalties through reset, reload and continuation", async () => {
    const run = await game(3);
    await execute(ownerId, "move", run.id, command(1));
    await execute(ownerId, "reset", run.id, {
      actionId: randomUUID(),
      expectedVersion: 2,
    });
    const reset = await stored(run.id);
    expect(reset.game.state.currentLock.invalidMovesOnCurrentPick).toBe(1);
    expect(reset.game.chestMetrics.invalidMoves).toBe(1);
    const solved = await execute(ownerId, "move", run.id, command(3, 1));
    expect(solved.body.run.status).toBe("chest_opened");
    expect(solved.body.run.reward?.oreNuggets).toBe(1);
    const next = await execute(ownerId, "continue", run.id, {
      actionId: randomUUID(),
      expectedVersion: 4,
    });
    expect(next.body.run.oreNuggets).toBe(1);
    expect(next.body.run.currentLock.invalidMovesOnCurrentPick).toBe(1);
    await expect(
      execute(ownerId, "continue", run.id, {
        actionId: randomUUID(),
        expectedVersion: 4,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await readRun(ownerId, run.id))?.oreNuggets).toBe(1);
  });

  it("compacts immediately on game over, restores only summary and claims one immutable result", async () => {
    const run = await game();
    const ended = await finish(run);
    const row = await stored(run.id);
    expect(row.game).toBeNull();
    expect(row.result).toMatchObject({
      oreNuggets: 0,
      openedChests: 0,
      totalMetrics: { moves: 4, invalidMoves: 4, brokenPicks: 1 },
    });
    expect(JSON.stringify(row.result)).not.toMatch(
      /pins|rules|initialLock|reward/,
    );
    expect(ended.currentLock.pins).toEqual([]);
    expect(ended.result?.totalMetrics?.brokenPicks).toBe(1);
    expect((await readEligibility(ownerId, run.id)).eligible).toBe(true);
    const input = { actionId: randomUUID(), nickname: "Klin" };
    const [first, retry] = await Promise.all([
      claimEntry(ownerId, run.id, input),
      claimEntry(ownerId, run.id, input),
    ]);
    expect(first.body).toEqual(retry.body);
    expect(
      (await pool.query("SELECT 1 FROM leaderboard_entries")).rowCount,
    ).toBe(1);
    await expect(claimEntry(otherId, run.id, input)).rejects.toMatchObject({
      code: "RUN_NOT_FOUND",
    });
    await expect(
      pool.query(
        "UPDATE leaderboard_entries SET ore_nuggets=999 WHERE run_id=$1",
        [run.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect(JSON.stringify(first.body)).not.toMatch(
      /ownerId|tokenHash|creationRequests/,
    );
    expect(
      (await pool.query("SELECT completed_games FROM global_game_stats"))
        .rows[0].completed_games,
    ).toBe("1");
  });

  it("counts abandonment once, drops its puzzle and prevents further reward claims", async () => {
    const run = await game(3);
    const input = { actionId: randomUUID(), expectedVersion: 1 };
    await execute(ownerId, "abandon", run.id, input);
    await expect(
      execute(ownerId, "abandon", run.id, input),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await stored(run.id)).game).toBeNull();
    expect(
      (await pool.query("SELECT abandoned_games FROM global_game_stats"))
        .rows[0].abandoned_games,
    ).toBe("1");
    expect(await readEligibility(ownerId, run.id)).toEqual({
      eligible: false,
      reason: "invalid_run",
    });
  });

  it("rolls back state, totals and accepted batch commands on persistence failure", async () => {
    const run = await game(2);
    await pool.query(
      `CREATE FUNCTION reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_write BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION reject_write()`,
    );
    try {
      await expect(
        executeMoveBatch(ownerId, run.id, [command(1), command(2)]),
      ).rejects.toThrow();
      await expect(
        execute(ownerId, "abandon", run.id, {
          actionId: randomUUID(),
          expectedVersion: 1,
        }),
      ).rejects.toThrow();
      expect((await stored(run.id)).version).toBe(1);
      expect(
        (await pool.query("SELECT abandoned_games FROM global_game_stats"))
          .rows[0].abandoned_games,
      ).toBe("0");
    } finally {
      await pool.query(
        "DROP TRIGGER reject_write ON runs; DROP FUNCTION reject_write()",
      );
    }
  });

  it("expires gameplay and pending results independently while preserving claimed scores and global totals", async () => {
    const old = new Date(Date.now() - 2 * 86400000);
    const run = await game(1, old);
    // Terminal insert invokes exactly the same compaction/counting trigger as finalization.
    await pool.query(
      "UPDATE runs SET status='abandoned',version=version+1 WHERE id=$1",
      [run.id],
    );
    expect((await stored(run.id)).game).toBeNull();
    expect(new Date((await stored(run.id)).expires_at).getTime()).toBeLessThan(
      Date.now(),
    );
    await expect(readRun(ownerId, run.id)).rejects.toMatchObject({
      code: "RUN_NOT_FOUND",
    });
    const totals = (
      await pool.query(
        "SELECT completed_games,abandoned_games FROM global_game_stats",
      )
    ).rows;
    expect(await cleanupExpiredRuns()).toEqual({ deletedRuns: 1 });
    expect(
      (
        await pool.query(
          "SELECT completed_games,abandoned_games FROM global_game_stats",
        )
      ).rows,
    ).toEqual(totals);
    expect(
      (await pool.query("SELECT id FROM sessions WHERE id=$1", [ownerId]))
        .rowCount,
    ).toBe(1);
    const fresh = await game();
    await finish(fresh);
    await claimEntry(ownerId, fresh.id, {
      actionId: randomUUID(),
      nickname: "Trwały",
    });
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
      [ownerId],
    );
    expect(await cleanupExpiredRuns()).toEqual({ deletedRuns: 1 });
    expect((await readTopRuns()).map((r) => r.runId)).toContain(fresh.id);
    expect(
      (await pool.query("SELECT 1 FROM sessions WHERE id=$1", [ownerId]))
        .rowCount,
    ).toBe(0);
    expect(await cleanupExpiredRuns()).toEqual({ deletedRuns: 0 });
  });
});
