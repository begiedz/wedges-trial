import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { newRun } from "@/server/game/engine";
import { execute, readRun } from "@/server/game/service";

let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
const url = process.env.TEST_DATABASE_URL;
let admin: Pool;
let pool: Pool;
let schemaName: string;

async function createDatabase(beforeLatest?: () => Promise<void>) {
  schemaName = `stats_test_${randomUUID().replaceAll("-", "")}`;
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
  for (const [index, entry] of journal.entries.entries()) {
    if (index === journal.entries.length - 1) await beforeLatest?.();
    await pool.query(
      (await readFile(`drizzle/${entry.tag}.sql`, "utf8")).replaceAll(
        '"public".',
        `"${schemaName}".`,
      ),
    );
  }
}

async function seed(status: "playing" | "finished" | "abandoned" = "playing") {
  const ownerId = randomUUID();
  await pool.query(
    "INSERT INTO sessions (id,token_hash,expires_at) VALUES ($1,$2,$3)",
    [ownerId, ownerId, new Date(Date.now() + 3600000)],
  );
  const run = newRun(randomUUID(), ownerId);
  run.status = status;
  run.game.state.oreNuggets = 7;
  run.game.openedChests = 2;
  run.game.totalMetrics = { moves: 3, invalidMoves: 3, brokenPicks: 0 };
  run.game.chestMetrics = { ...run.game.totalMetrics };
  run.game.state.lockpicks = status === "finished" ? 0 : 1;
  run.game.state.currentLock = {
    pins: [{ id: 0, position: 0, min: 0, max: 1, target: 1 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    invalidMovesOnCurrentPick: 3,
    maxInvalidMovesPerPick: 4,
    isSolved: false,
    isFailed: status === "finished",
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  if (status === "finished") run.game.finishedAt = new Date().toISOString();
  await pool.query(
    "INSERT INTO runs (id,owner_id,version,status,ruleset_version,game,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)",
    [
      run.id,
      run.ownerId,
      run.version,
      run.status,
      run.rulesetVersion,
      JSON.stringify(run.game),
      run.createdAt,
      run.updatedAt,
    ],
  );
  return run;
}

async function counters() {
  const { rows } = await pool.query(`SELECT completed_games, abandoned_games,
    opened_chests, moves, invalid_moves, broken_picks, ore_nuggets
    FROM global_game_stats WHERE id=1`);
  return rows[0];
}
const zero = {
  completed_games: "0",
  abandoned_games: "0",
  opened_chests: "0",
  moves: "0",
  invalid_moves: "0",
  broken_picks: "0",
  ore_nuggets: "0",
};

describe.skipIf(!url)("compact global game statistics", () => {
  afterEach(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.end();
    }
  });

  it("backfills existing finished and abandoned totals once during upgrade", async () => {
    let claimed: Awaited<ReturnType<typeof seed>> | undefined;
    await createDatabase(async () => {
      claimed = await seed("finished");
      await pool.query(
        "INSERT INTO leaderboard_entries (run_id,nickname) VALUES ($1,'Legacy')",
        [claimed.id],
      );
      await seed("abandoned");
      await seed("playing");
    });
    expect(await counters()).toEqual({
      completed_games: "1",
      abandoned_games: "1",
      opened_chests: "4",
      moves: "6",
      invalid_moves: "6",
      broken_picks: "0",
      ore_nuggets: "14",
    });
    const { rows } = await pool.query(
      "SELECT * FROM leaderboard_entries WHERE run_id=$1",
      [claimed?.id],
    );
    expect(rows[0]).toMatchObject({
      run_id: claimed?.id,
      owner_id: claimed?.ownerId,
      nickname: "Legacy",
      ruleset_version: claimed?.rulesetVersion,
      ore_nuggets: "7",
      opened_chests: 2,
      total_metrics: { moves: 3, invalidMoves: 3, brokenPicks: 0 },
    });
    expect(rows[0].finished_at.toISOString()).toBe(claimed?.game.finishedAt);
  });

  it("counts finalization once under concurrent retries and keeps abandonment separate", async () => {
    await createDatabase();
    const run = await seed();
    expect(await counters()).toEqual(zero);
    const command = {
      actionId: randomUUID(),
      expectedVersion: run.version,
      pinId: 0,
      direction: -1 as const,
    };
    const replies = await Promise.allSettled([
      execute(run.ownerId, "move", run.id, command),
      execute(run.ownerId, "move", run.id, command),
    ]);
    expect(
      replies.filter((reply) => reply.status === "fulfilled"),
    ).toHaveLength(1);
    await expect(
      execute(run.ownerId, "move", run.id, command),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    await readRun(run.ownerId, run.id);
    expect(await counters()).toEqual({
      completed_games: "1",
      abandoned_games: "0",
      opened_chests: "2",
      moves: "4",
      invalid_moves: "4",
      broken_picks: "1",
      ore_nuggets: "7",
    });
    const abandoned = await seed();
    const abandonCommand = { actionId: randomUUID(), expectedVersion: 1 };
    await execute(abandoned.ownerId, "abandon", abandoned.id, abandonCommand);
    await expect(
      execute(abandoned.ownerId, "abandon", abandoned.id, abandonCommand),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await counters()).toEqual({
      completed_games: "1",
      abandoned_games: "1",
      opened_chests: "4",
      moves: "7",
      invalid_moves: "7",
      broken_picks: "1",
      ore_nuggets: "14",
    });
  });

  it("rolls statistics back with a failed terminal transaction", async () => {
    await createDatabase();
    const run = await seed();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE runs SET status='abandoned',version=version+1 WHERE id=$1",
        [run.id],
      );
      expect(
        (
          await client.query(
            "SELECT abandoned_games FROM global_game_stats WHERE id=1",
          )
        ).rows[0].abandoned_games,
      ).toBe("1");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    expect(await counters()).toEqual(zero);
    expect((await readRun(run.ownerId, run.id))?.status).toBe("playing");
  });

  it("counts authoritative terminal inserts and does not change totals when payloads are removed", async () => {
    await createDatabase();
    const run = await seed("finished");
    const before = await counters();
    expect(before.completed_games).toBe("1");
    await pool.query("DELETE FROM runs WHERE id=$1", [run.id]);
    expect(await counters()).toEqual(before);
    await expect(
      pool.query("INSERT INTO global_game_stats (id) VALUES (2)"),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
