import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newRun } from "@/server/game/engine";

const { runMigrations, MIGRATION_LOCK } = createRequire(import.meta.url)(
  "../../scripts/migrate.cjs",
);
const url = process.env.TEST_DATABASE_URL;
let admin: Pool;
let pool: Pool;
let schemaName: string;
let journalSchema: string;
let directory: string;
let journal: {
  entries: {
    idx: number;
    when: number;
    tag: string;
    breakpoints: boolean;
    version: string;
  }[];
};
describe.skipIf(!url)("serialized migration runner on PostgreSQL", () => {
  beforeEach(async () => {
    schemaName = `migration_test_${randomUUID().replaceAll("-", "")}`;
    journalSchema = `${schemaName}_journal`;
    directory = await mkdtemp(join(tmpdir(), "migration-fixture-"));
    await mkdir(join(directory, "meta"));
    journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
    await writeFile(
      join(directory, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    for (const entry of journal.entries) {
      const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
      await writeFile(
        join(directory, `${entry.tag}.sql`),
        sql.replaceAll('"public".', `"${schemaName}".`),
      );
    }
    admin = new Pool({ connectionString: url, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${schemaName}`,
      max: 2,
    });
  });
  afterEach(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${journalSchema}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.end();
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  const options = () => ({
    migrationsFolder: directory,
    migrationsSchema: journalSchema,
  });
  const historyCount = async () =>
    Number(
      (
        await admin.query(
          `SELECT count(*) FROM "${journalSchema}".__drizzle_migrations`,
        )
      ).rows[0].count,
    );
  const assertLockReleased = async () => {
    const client = await admin.connect();
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock($1::integer,$2::integer) AS acquired",
        MIGRATION_LOCK,
      );
      expect(result.rows[0].acquired).toBe(true);
    } finally {
      client.release(true);
    }
  };
  it("initializes the full schema once during concurrent cold starts and skips applied migrations", async () => {
    await Promise.all([
      runMigrations(pool, options()),
      runMigrations(pool, options()),
    ]);
    expect(await historyCount()).toBe(journal.entries.length);
    const tables = (
      await admin.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=$1",
        [schemaName],
      )
    ).rows.map((row) => row.table_name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "sessions",
        "runs",
        "leaderboard_entries",
        "global_game_stats",
      ]),
    );
    await runMigrations(pool, options());
    expect(await historyCount()).toBe(journal.entries.length);
    await assertLockReleased();
  });
  it("requires an explicit cutover for an existing legacy database and ends with four application tables", async () => {
    const fullJournal = structuredClone(journal);
    const cutover = fullJournal.entries.findIndex(
      (entry) => entry.tag === "0005_minimal-storage",
    );
    expect(cutover).toBeGreaterThan(0);
    journal.entries = fullJournal.entries.slice(0, cutover);
    await writeFile(
      join(directory, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    await runMigrations(pool, options());
    const owner = randomUUID();
    const created = randomUUID();
    const claimed = randomUUID();
    const run = newRun(randomUUID(), owner);
    run.status = "finished";
    run.game.state.lockpicks = 0;
    run.game.state.currentLock.isFailed = true;
    run.game.finishedAt = new Date().toISOString();
    await pool.query(
      "INSERT INTO sessions(id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 days')",
      [owner, owner],
    );
    await pool.query(
      "INSERT INTO runs(id,owner_id,version,status,ruleset_version,game) VALUES($1,$2,1,'finished',$3,$4::jsonb)",
      [run.id, owner, run.rulesetVersion, JSON.stringify(run.game)],
    );
    await pool.query(
      "INSERT INTO leaderboard_entries(run_id,nickname) VALUES($1,'Preserved')",
      [run.id],
    );
    await pool.query(
      "INSERT INTO run_actions(owner_id,action_id,run_id,fingerprint,response,status_code) VALUES($1,$2,$3,'legacy-create',$4::jsonb,201),($1,$5,$3,'legacy-claim',$6::jsonb,200)",
      [
        owner,
        created,
        run.id,
        JSON.stringify({ outcome: "run_started" }),
        claimed,
        JSON.stringify({ outcome: "leaderboard_claimed", entry: { rank: 1 } }),
      ],
    );
    await pool.query(
      "INSERT INTO leaderboard_request_budgets(key,requests,expires_at) VALUES($1,2,now()+interval '1 minute')",
      [`claim:${owner}`],
    );
    await writeFile(
      join(directory, "meta/_journal.json"),
      JSON.stringify(fullJournal),
    );
    await expect(runMigrations(pool, options())).rejects.toThrow(
      "STORAGE_CUTOVER_REQUIRED",
    );
    expect(await historyCount()).toBe(cutover);
    await runMigrations(pool, { ...options(), allowStorageCutover: true });
    expect(await historyCount()).toBe(fullJournal.entries.length);
    const compact = (
      await pool.query("SELECT game,result FROM runs WHERE id=$1", [run.id])
    ).rows[0];
    expect(compact.game).toBeNull();
    expect(compact.result).toMatchObject({ oreNuggets: 0, openedChests: 0 });
    const preservedOwner = (
      await pool.query(
        "SELECT creation_requests,claim_requests FROM sessions WHERE id=$1",
        [owner],
      )
    ).rows[0];
    expect(preservedOwner.creation_requests).toEqual({ [created]: run.id });
    expect(preservedOwner.claim_requests).toBe(2);
    expect(
      (
        await pool.query(
          "SELECT claim_action_id,claimed_rank,nickname FROM leaderboard_entries WHERE run_id=$1",
          [run.id],
        )
      ).rows[0],
    ).toEqual({
      claim_action_id: claimed,
      claimed_rank: 1,
      nickname: "Preserved",
    });
    expect(
      (await pool.query("SELECT completed_games FROM global_game_stats"))
        .rows[0].completed_games,
    ).toBe("1");
    await runMigrations(pool, options());
    expect(
      (await pool.query("SELECT completed_games FROM global_game_stats"))
        .rows[0].completed_games,
    ).toBe("1");
    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",
      [schemaName],
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      "global_game_stats",
      "leaderboard_entries",
      "runs",
      "sessions",
    ]);
    await assertLockReleased();
  });
  it("rolls back failed SQL, releases the session lock and supports retry", async () => {
    await runMigrations(pool, options());
    const originalCount = journal.entries.length;
    journal.entries.push({
      idx: originalCount,
      when: journal.entries[originalCount - 1].when + 1,
      tag: "0004_test_failure",
      breakpoints: true,
      version: "7",
    });
    await writeFile(
      join(directory, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    await writeFile(
      join(directory, "0004_test_failure.sql"),
      "CREATE TABLE rollback_marker (id integer);\n--> statement-breakpoint\nSELECT migration_missing_function();",
    );
    await expect(runMigrations(pool, options())).rejects.toThrow();
    expect(await historyCount()).toBe(originalCount);
    expect(
      (
        await admin.query("SELECT to_regclass($1) AS relation", [
          `${schemaName}.rollback_marker`,
        ])
      ).rows[0].relation,
    ).toBeNull();
    await assertLockReleased();
    await writeFile(
      join(directory, "0004_test_failure.sql"),
      "CREATE TABLE rollback_marker (id integer);",
    );
    await runMigrations(pool, options());
    expect(await historyCount()).toBe(originalCount + 1);
  });
  it("times out before reading or creating the journal when another runner owns the lock", async () => {
    const holder = await admin.connect();
    try {
      await holder.query(
        "SELECT pg_advisory_lock($1::integer,$2::integer)",
        MIGRATION_LOCK,
      );
      await expect(
        runMigrations(pool, { ...options(), lockTimeoutMs: 50 }),
      ).rejects.toMatchObject({ code: "55P03" });
      expect(
        (
          await admin.query("SELECT to_regnamespace($1) AS schema", [
            journalSchema,
          ])
        ).rows[0].schema,
      ).toBeNull();
    } finally {
      holder.release(true);
    }
    await runMigrations(pool, options());
    expect(await historyCount()).toBe(journal.entries.length);
    await assertLockReleased();
  });
});
