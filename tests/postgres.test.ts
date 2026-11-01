import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { newRun } from "@/server/game/engine";
import {
  bootstrap,
  execute,
  findSession,
  readRun,
} from "@/server/game/service";

let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
const url = process.env.TEST_DATABASE_URL;
const schemaName = `trial_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let pool: Pool;
const ownerId = randomUUID();
const otherId = randomUUID();
const actionId = () => randomUUID();
async function seed() {
  const run = newRun(randomUUID(), ownerId);
  run.game.state.currentLock = {
    pins: [{ id: 0, position: 0, min: 0, max: 2, target: 2 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 3,
    isSolved: false,
    isFailed: false,
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  await db.insert(schema.runs).values(run);
  return run;
}
describe.skipIf(!url)("PostgreSQL ownership, concurrency and rollback", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${schemaName}`,
      max: 6,
    });
    db = drizzle(pool, { schema });
    const migration = await readFile("drizzle/0000_needy_alice.sql", "utf8");
    await pool.query(migration.replaceAll('"public".', `"${schemaName}".`));
    await db.insert(schema.sessions).values(
      [ownerId, otherId].map((id) => ({
        id,
        tokenHash: id,
        expiresAt: new Date(Date.now() + 60000),
      })),
    );
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await admin.end();
    }
  });
  it("stores only hashed credentials, resumes and rejects invalid/expired cookies", async () => {
    const result = await bootstrap(undefined);
    const session = await findSession(result.token ?? undefined);
    expect(session?.tokenHash).not.toBe(result.token);
    expect(await bootstrap(result.token ?? undefined)).toEqual({ token: null });
    expect(await findSession("invalid")).toBeNull();
    await pool.query(
      "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id=$1",
      [session?.id],
    );
    expect(await findSession(result.token ?? undefined)).toBeNull();
  });
  it("serializes create retries and prevents concurrent active runs", async () => {
    const owner = randomUUID();
    await db.insert(schema.sessions).values({
      id: owner,
      tokenHash: owner,
      expiresAt: new Date(Date.now() + 60000),
    });
    const key = actionId();
    const replies = await Promise.all([
      execute(owner, "create", undefined, { actionId: key }),
      execute(owner, "create", undefined, { actionId: key }),
    ]);
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0].status).toBe(201);
    await expect(
      execute(owner, "create", undefined, { actionId: actionId() }),
    ).rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS" });
  });
  it("commits one racing move, restores damage, and rejects foreign access", async () => {
    const run = await seed();
    const outcomes = await Promise.allSettled(
      [1, 2].map(() =>
        execute(ownerId, "move", run.id, {
          actionId: actionId(),
          expectedVersion: 1,
          pinId: 0,
          direction: -1,
        }),
      ),
    );
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((x) => x.status === "rejected")).toMatchObject({
      reason: { code: "VERSION_CONFLICT" },
    });
    expect(
      (await readRun(ownerId, run.id))?.currentLock.invalidMovesOnCurrentPick,
    ).toBe(1);
    await expect(readRun(otherId, run.id)).rejects.toMatchObject({
      code: "RUN_NOT_FOUND",
    });
    await expect(
      execute(otherId, "reset", run.id, {
        actionId: actionId(),
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "RUN_NOT_FOUND" });
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: 2,
    });
  });
  it("replays exact responses after later transitions and credits concurrent continue once", async () => {
    const run = await seed();
    const first = {
      actionId: actionId(),
      expectedVersion: 1,
      pinId: 0,
      direction: 1 as const,
    };
    const original = await execute(ownerId, "move", run.id, first);
    await execute(ownerId, "move", run.id, {
      ...first,
      actionId: actionId(),
      expectedVersion: 2,
    });
    expect(await execute(ownerId, "move", run.id, first)).toEqual(original);
    await expect(
      execute(ownerId, "move", run.id, { ...first, direction: -1 }),
    ).rejects.toMatchObject({ code: "ACTION_ID_REUSED" });
    const next = { actionId: actionId(), expectedVersion: 3 };
    const replies = await Promise.all([
      execute(ownerId, "continue", run.id, next),
      execute(ownerId, "continue", run.id, next),
    ]);
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0].body.run.oreNuggets).toBe(10);
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: 4,
    });
  });
  it("rolls back state and replay record when action persistence fails", async () => {
    const run = await seed();
    const key = actionId();
    // Fault injection in the same PostgreSQL transaction, after the run UPDATE.
    await pool.query(
      `ALTER TABLE run_actions ADD CONSTRAINT injected_failure CHECK (action_id <> '${key}'::uuid)`,
    );
    await expect(
      execute(ownerId, "move", run.id, {
        actionId: key,
        expectedVersion: 1,
        pinId: 0,
        direction: -1,
      }),
    ).rejects.toThrow();
    const restored = await readRun(ownerId, run.id);
    expect(restored?.version).toBe(1);
    expect(restored?.currentLock.invalidMovesOnCurrentPick).toBe(0);
    await pool.query(
      "ALTER TABLE run_actions DROP CONSTRAINT injected_failure",
    );
    const retry = await execute(ownerId, "move", run.id, {
      actionId: key,
      expectedVersion: 1,
      pinId: 0,
      direction: -1,
    });
    expect(retry.body.run.version).toBe(2);
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: 2,
    });
  });
});
