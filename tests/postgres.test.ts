import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { executeMoveBatch } from "@/server/game/moveBatch";
import { bindGameSocket } from "@/server/game/socket";

const { WebSocket, WebSocketServer } = createRequire(import.meta.url)("ws");

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupExpiredRuns } from "@/server/db/retention";
import * as schema from "@/server/db/schema";
import { newRun } from "@/server/game/engine";
import {
  bootstrap,
  execute,
  findSession,
  readRun,
} from "@/server/game/service";
import { readTopRuns } from "@/server/leaderboard/read";

let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
const url = process.env.TEST_DATABASE_URL;
const schemaName = `trial_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let pool: Pool;
const ownerId = randomUUID();
const otherId = randomUUID();
const legacyRunId = randomUUID();
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
async function storedGame(id: string) {
  const { rows } = await pool.query("SELECT game FROM runs WHERE id=$1", [id]);
  return rows[0].game as ReturnType<typeof newRun>["game"];
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
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries) {
      const migration = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
      await pool.query(migration.replaceAll('"public".', `"${schemaName}".`));
      if (entry.idx === 0) {
        const legacyOwner = randomUUID();
        const legacy = newRun(legacyRunId, legacyOwner);
        legacy.status = "finished";
        legacy.game.finishedAt = "2026-01-01T13:00:00+01:00";
        legacy.game.state.lockpicks = 0;
        legacy.game.state.currentLock.isFailed = true;
        await pool.query(
          "INSERT INTO sessions (id,token_hash,expires_at) VALUES ($1::uuid,$1::text,now() + interval '1 day')",
          [legacyOwner],
        );
        await pool.query(
          "INSERT INTO runs (id,owner_id,version,status,ruleset_version,game) VALUES ($1,$2,1,'finished',$3,$4)",
          [
            legacyRunId,
            legacyOwner,
            legacy.rulesetVersion,
            JSON.stringify(legacy.game),
          ],
        );
      }
    }
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
  it("upgrades existing finished documents and backfills the indexed finish instant", async () => {
    const { rows } = await pool.query(
      "SELECT finished_at,ore_nuggets,opened_chests FROM runs WHERE id=$1",
      [legacyRunId],
    );
    expect(rows[0].finished_at.toISOString()).toBe("2026-01-01T12:00:00.000Z");
    expect(Number(rows[0].ore_nuggets)).toBe(0);
    expect(rows[0].opened_chests).toBe(0);
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
    expect((await storedGame(run.id)).totalMetrics).toEqual({
      moves: 1,
      invalidMoves: 1,
      brokenPicks: 0,
    });
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
    expect((await storedGame(run.id)).totalMetrics).toEqual({
      moves: 2,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    const next = { actionId: actionId(), expectedVersion: 3 };
    const replies = await Promise.all([
      execute(ownerId, "continue", run.id, next),
      execute(ownerId, "continue", run.id, next),
    ]);
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0].body.run.oreNuggets).toBe(10);
    const continued = await storedGame(run.id);
    expect(continued.chestMetrics).toEqual({
      moves: 0,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    expect(continued.totalMetrics).toEqual({
      moves: 2,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    expect(continued.initialLock.optimalMoves).toBe(
      continued.state.currentLock.optimalMoves,
    );
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: 4,
    });
  });

  it("preserves cumulative reward penalties through reload, racing solve/claim, replay and claim rollback", async () => {
    const run = await seed();
    let version = 1;
    for (let i = 0; i < 4; i++) {
      const move = {
        actionId: actionId(),
        expectedVersion: version++,
        pinId: 0,
        direction: -1 as const,
      };
      const original = await execute(ownerId, "move", run.id, move);
      expect(await execute(ownerId, "move", run.id, move)).toEqual(original);
      await execute(ownerId, "reset", run.id, {
        actionId: actionId(),
        expectedVersion: version++,
      });
    }
    expect((await storedGame(run.id)).chestMetrics).toEqual({
      moves: 4,
      invalidMoves: 4,
      brokenPicks: 1,
    });
    expect(
      (await readRun(ownerId, run.id))?.currentLock.invalidMovesOnCurrentPick,
    ).toBe(1);
    await execute(ownerId, "move", run.id, {
      actionId: actionId(),
      expectedVersion: version++,
      pinId: 0,
      direction: 1,
    });
    const solveVersion = version++;
    const solves = await Promise.allSettled(
      [1, 2].map(() =>
        execute(ownerId, "move", run.id, {
          actionId: actionId(),
          expectedVersion: solveVersion,
          pinId: 0,
          direction: 1,
        }),
      ),
    );
    expect(solves.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(solves.find((x) => x.status === "rejected")).toMatchObject({
      reason: { code: "VERSION_CONFLICT" },
    });
    const opened = await readRun(ownerId, run.id);
    expect(opened?.reward?.oreNuggets).toBe(6);
    expect(opened?.oreNuggets).toBe(0);
    const pending = (await storedGame(run.id)).reward;
    const claim = { actionId: actionId(), expectedVersion: version };
    await pool.query(
      `ALTER TABLE run_actions ADD CONSTRAINT reward_failure CHECK (action_id <> '${claim.actionId}'::uuid)`,
    );
    try {
      await expect(
        execute(ownerId, "continue", run.id, claim),
      ).rejects.toThrow();
      expect(await readRun(ownerId, run.id)).toEqual(opened);
      expect((await storedGame(run.id)).reward).toEqual(pending);
      expect(
        (
          await pool.query("SELECT 1 FROM run_actions WHERE action_id=$1", [
            claim.actionId,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await pool.query(
        "ALTER TABLE run_actions DROP CONSTRAINT reward_failure",
      );
    }
    const competingClaims = [claim, { ...claim, actionId: actionId() }];
    const claims = await Promise.allSettled(
      competingClaims.map((command) =>
        execute(ownerId, "continue", run.id, command),
      ),
    );
    expect(claims.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(claims.find((x) => x.status === "rejected")).toMatchObject({
      reason: { code: "VERSION_CONFLICT" },
    });
    const credited = await readRun(ownerId, run.id);
    expect(credited?.oreNuggets).toBe(6);
    expect(credited?.lockpicks).toBe(2 + (pending?.lockpicks ?? 0));
    expect(credited?.currentLock.invalidMovesOnCurrentPick).toBe(1);
    expect((await storedGame(run.id)).chestMetrics).toEqual({
      moves: 0,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    const winnerIndex = claims.findIndex(
      (result) => result.status === "fulfilled",
    );
    const winner = claims[winnerIndex];
    expect(winner.status).toBe("fulfilled");
    if (winner.status === "fulfilled")
      expect(
        await execute(
          ownerId,
          "continue",
          run.id,
          competingClaims[winnerIndex],
        ),
      ).toEqual(winner.value);
    expect(await readRun(ownerId, run.id)).toEqual(credited);
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: version + 1,
    });
  });

  it("preserves mistakes and broken picks across refresh, repeated resets and final-action retries", async () => {
    const run = await seed();
    let version = 1;
    for (let i = 0; i < 9; i++) {
      const command = {
        actionId: actionId(),
        expectedVersion: version,
        pinId: 0,
        direction: -1 as const,
      };
      const result = await execute(ownerId, "move", run.id, command);
      expect(await execute(ownerId, "move", run.id, command)).toEqual(result);
      version++;
      expect((await readRun(ownerId, run.id))?.version).toBe(version);
      if (i < 8) {
        for (let reset = 0; reset < 2; reset++) {
          await execute(ownerId, "reset", run.id, {
            actionId: actionId(),
            expectedVersion: version++,
          });
        }
      }
      const game = await storedGame(run.id);
      const expected = {
        moves: i + 1,
        invalidMoves: i + 1,
        brokenPicks: Math.floor((i + 1) / 3),
      };
      expect(game.chestMetrics).toEqual(expected);
      expect(game.totalMetrics).toEqual(expected);
      expect(game.state.currentLock.invalidMovesOnCurrentPick).toBe(
        (i + 1) % 3,
      );
    }
    const finished = await readRun(ownerId, run.id);
    expect(finished?.status).toBe("finished");
    expect(finished?.result?.totalMetrics).toEqual({
      moves: 9,
      invalidMoves: 9,
      brokenPicks: 3,
    });
    await expect(
      execute(ownerId, "move", run.id, {
        actionId: actionId(),
        expectedVersion: version,
        pinId: 0,
        direction: -1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RUN_STATUS" });
    expect((await storedGame(run.id)).totalMetrics.moves).toBe(9);
  });

  it("commits and replays a rapid burst over a real WebSocket connection", async () => {
    const run = await seed();
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    server.on(
      "connection",
      (socket: import("@/server/game/socket").GameSocket) => {
        void bindGameSocket(
          socket,
          ownerId,
          run.id,
          new Date(Date.now() + 60000),
        );
      },
    );
    const connect = () =>
      new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    let client = connect();
    const messages: Array<{
      type: string;
      response?: { run: { version: number } };
    }> = [];
    client.on("message", (data: { toString(): string }) =>
      messages.push(JSON.parse(data.toString())),
    );
    try {
      await vi.waitFor(() => expect(messages[0]?.type).toBe("ready"));
      const frames = Array.from({ length: 20 }, (_, index) => ({
        type: "action",
        runId: run.id,
        action: "move",
        body: {
          actionId: actionId(),
          expectedVersion: index + 1,
          pinId: 0,
          direction: index % 2 === 0 ? 1 : -1,
        },
      }));
      const started = performance.now();
      for (const frame of frames) client.send(JSON.stringify(frame));
      await vi.waitFor(
        () =>
          expect(messages.filter((x) => x.type === "result")).toHaveLength(20),
        { timeout: 10000 },
      );
      const burstMs = performance.now() - started;
      expect((await storedGame(run.id)).totalMetrics).toEqual({
        moves: 20,
        invalidMoves: 0,
        brokenPicks: 0,
      });
      const state = await readRun(ownerId, run.id);
      expect(state?.version).toBe(21);
      expect(state?.currentLock.pins[0].position).toBe(0);
      // A new transport retries unknown acknowledgements using the original IDs.
      const closed = new Promise<void>((resolve) =>
        client.once("close", resolve),
      );
      client.close();
      await closed;
      client = connect();
      client.on("message", (data: { toString(): string }) =>
        messages.push(JSON.parse(data.toString())),
      );
      await vi.waitFor(() =>
        expect(messages.filter((x) => x.type === "ready")).toHaveLength(2),
      );
      for (const frame of frames) client.send(JSON.stringify(frame));
      await vi.waitFor(
        () =>
          expect(messages.filter((x) => x.type === "result")).toHaveLength(40),
        { timeout: 10000 },
      );
      expect((await readRun(ownerId, run.id))?.version).toBe(21);
      expect((await storedGame(run.id)).totalMetrics.moves).toBe(20);
      console.info(
        `WebSocket burst: 20 moves committed in ${Math.round(burstMs)} ms; replay preserved version 21.`,
      );
      await execute(ownerId, "abandon", run.id, {
        actionId: actionId(),
        expectedVersion: 21,
      });
    } finally {
      client.close();
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });
  it("rolls back every accepted move when a batched replay write fails", async () => {
    const run = await seed();
    const key = actionId();
    const commands = [
      { actionId: key, expectedVersion: 1, pinId: 0, direction: 1 as const },
      {
        actionId: actionId(),
        expectedVersion: 2,
        pinId: 0,
        direction: -1 as const,
      },
    ];
    await pool.query(
      `ALTER TABLE run_actions ADD CONSTRAINT batch_failure CHECK (action_id <> '${key}'::uuid)`,
    );
    await expect(executeMoveBatch(ownerId, run.id, commands)).rejects.toThrow();
    expect((await readRun(ownerId, run.id))?.version).toBe(1);
    expect((await storedGame(run.id)).totalMetrics.moves).toBe(0);
    await pool.query("ALTER TABLE run_actions DROP CONSTRAINT batch_failure");
    const retries = await executeMoveBatch(ownerId, run.id, commands);
    expect(retries).toHaveLength(2);
    expect((await readRun(ownerId, run.id))?.version).toBe(3);
    expect((await storedGame(run.id)).totalMetrics).toEqual({
      moves: 2,
      invalidMoves: 0,
      brokenPicks: 0,
    });
    await execute(ownerId, "abandon", run.id, {
      actionId: actionId(),
      expectedVersion: 3,
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
    expect((await storedGame(run.id)).totalMetrics).toEqual({
      moves: 0,
      invalidMoves: 0,
      brokenPicks: 0,
    });
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
  it("rejects revoked credentials even on an already connected mutation", async () => {
    const result = await bootstrap(undefined);
    const session = await findSession(result.token ?? undefined);
    if (!session) throw new Error("Missing session");
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [
      session?.id,
    ]);
    expect(await findSession(result.token ?? undefined)).toBeNull();
    await expect(
      execute(session.id, "create", undefined, { actionId: actionId() }),
    ).rejects.toMatchObject({ code: "SESSION_REQUIRED" });
  });

  it("checks missing/negative resources and metrics, active uniqueness and replay ownership", async () => {
    const owner = randomUUID();
    await db.insert(schema.sessions).values({
      id: owner,
      tokenHash: owner,
      expiresAt: new Date(Date.now() + 60000),
    });
    for (const mutate of [
      (r: ReturnType<typeof newRun>) => {
        r.game.totalMetrics.moves = -1;
      },
      (r: ReturnType<typeof newRun>) => {
        r.game.state.oreNuggets = -1;
      },
      (r: ReturnType<typeof newRun>) => {
        delete (r.game as Partial<typeof r.game>).chestMetrics;
      },
    ]) {
      const invalid = newRun(randomUUID(), owner);
      mutate(invalid);
      await expect(db.insert(schema.runs).values(invalid)).rejects.toThrow();
    }
    const run = newRun(randomUUID(), owner);
    await db.insert(schema.runs).values(run);
    await expect(
      db.insert(schema.runs).values(newRun(randomUUID(), owner)),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "INSERT INTO run_actions (owner_id,action_id,run_id,fingerprint,response,status_code) VALUES ($1,$2,$3,'x','{}',200)",
        [otherId, actionId(), run.id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db
        .insert(schema.leaderboardEntries)
        .values({ runId: run.id, nickname: "Wedge" }),
    ).rejects.toThrow();
  });

  it("stores multiple immutable finished runs per owner and one durable claim per run", async () => {
    const finished = Array.from({ length: 2 }, () => {
      const run = newRun(randomUUID(), otherId);
      run.status = "finished";
      run.game.finishedAt = new Date().toISOString();
      run.game.state.lockpicks = 0;
      run.game.state.currentLock.isFailed = true;
      return run;
    });
    await db.insert(schema.runs).values(finished);
    for (const nickname of ["", " ", " Wedge", "x".repeat(25), "a\nb"]) {
      await expect(
        db
          .insert(schema.leaderboardEntries)
          .values({ runId: finished[0].id, nickname }),
      ).rejects.toThrow();
    }
    const claims = await Promise.allSettled(
      [1, 2].map(() =>
        db
          .insert(schema.leaderboardEntries)
          .values({ runId: finished[0].id, nickname: "Wedge" }),
      ),
    );
    expect(claims.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    await db
      .insert(schema.leaderboardEntries)
      .values({ runId: finished[1].id, nickname: "Wedge" });
    await expect(
      pool.query(
        "UPDATE runs SET game = jsonb_set(game, '{state,oreNuggets}', '999') WHERE id = $1",
        [finished[0].id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query("DELETE FROM leaderboard_entries WHERE run_id = $1", [
        finished[0].id,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query("DELETE FROM runs WHERE id = $1", [finished[0].id]),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("reads only the best 100 claimed runs with cohort and chronological tie breaks", async () => {
    const finished = Array.from({ length: 103 }, (_, i) => {
      const run = newRun(randomUUID(), otherId);
      run.status = "finished";
      run.rulesetVersion = i === 102 ? "future" : run.rulesetVersion;
      run.game.finishedAt =
        i === 0 ? "2026-01-01T13:00:00+01:00" : "2026-01-01T12:00:00Z";
      run.game.state.lockpicks = 0;
      run.game.state.currentLock.isFailed = true;
      run.game.state.oreNuggets = 1000;
      run.game.openedChests = 5;
      return run;
    });
    await db.insert(schema.runs).values(finished);
    await db.insert(schema.leaderboardEntries).values(
      finished
        .slice(0, 101)
        .concat(finished[102])
        .map((r) => ({ runId: r.id, nickname: "Wedge" })),
    );
    const top = await readTopRuns();
    expect(top).toHaveLength(100);
    expect(top.map((r) => r.runId)).toEqual(
      finished
        .slice(0, 101)
        .map((r) => r.id)
        .sort()
        .slice(0, 100),
    );
    expect(top.every((r) => r.oreNuggets === 1000)).toBe(true);
  });

  it("cleans only expired old unclaimed terminal runs, preserving live recovery, recent replay, active runs and claims", async () => {
    const expired = randomUUID();
    const live = randomUUID();
    const old = new Date(Date.now() - 31 * 86400000);
    await db.insert(schema.sessions).values(
      [expired, live].map((id) => ({
        id,
        tokenHash: id,
        expiresAt: id === expired ? old : new Date(Date.now() + 60000),
      })),
    );
    const fixtures = Array.from({ length: 6 }, (_, i) => {
      const run = newRun(randomUUID(), i === 1 ? live : expired, old);
      run.status = i === 2 ? "playing" : i === 4 ? "finished" : "abandoned";
      if (run.status === "finished") {
        run.game.finishedAt = old.toISOString();
        run.game.state.lockpicks = 0;
        run.game.state.currentLock.isFailed = true;
      }
      if (i === 5) run.updatedAt = new Date();
      return run;
    });
    await db.insert(schema.runs).values(fixtures);
    await db
      .insert(schema.leaderboardEntries)
      .values({ runId: fixtures[4].id, nickname: "Keeper" });
    for (const i of [0, 1, 3]) {
      await pool.query(
        "INSERT INTO run_actions (owner_id,action_id,run_id,fingerprint,response,status_code,created_at) VALUES ($1,$2,$3,'original','{}',200,$4)",
        [
          fixtures[i].ownerId,
          actionId(),
          fixtures[i].id,
          i === 3 ? new Date() : old,
        ],
      );
    }
    const cleanups = await Promise.all([
      cleanupExpiredRuns(),
      cleanupExpiredRuns(),
    ]);
    expect(cleanups.reduce((sum, result) => sum + result.deletedRuns, 0)).toBe(
      1,
    );
    const remaining = await pool.query(
      "SELECT id FROM runs WHERE id = ANY($1::uuid[])",
      [fixtures.map((r) => r.id)],
    );
    expect(remaining.rows.map((r) => r.id).sort()).toEqual(
      fixtures
        .slice(1)
        .map((r) => r.id)
        .sort(),
    );
    expect(
      (
        await pool.query(
          "SELECT fingerprint FROM run_actions WHERE run_id = $1",
          [fixtures[1].id],
        )
      ).rows[0].fingerprint,
    ).toBe("original");
    expect(await cleanupExpiredRuns()).toEqual({ deletedRuns: 0 });
  });
  it("rolls cleanup back together with replay deletion if removing the run fails", async () => {
    const owner = randomUUID();
    const old = new Date(Date.now() - 31 * 86400000);
    await db
      .insert(schema.sessions)
      .values({ id: owner, tokenHash: owner, expiresAt: old });
    const run = newRun(randomUUID(), owner, old);
    run.status = "abandoned";
    await db.insert(schema.runs).values(run);
    await pool.query(
      "INSERT INTO run_actions (owner_id,action_id,run_id,fingerprint,response,status_code,created_at) VALUES ($1,$2,$3,'rollback','{}',200,$4)",
      [owner, actionId(), run.id, old],
    );
    await pool.query(
      `CREATE FUNCTION fail_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${run.id}'::uuid THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN OLD; END $$; CREATE TRIGGER fail_cleanup BEFORE DELETE ON runs FOR EACH ROW EXECUTE FUNCTION fail_cleanup()`,
    );
    try {
      await expect(cleanupExpiredRuns()).rejects.toThrow();
      expect(
        (
          await pool.query("SELECT 1 FROM run_actions WHERE run_id=$1", [
            run.id,
          ])
        ).rowCount,
      ).toBe(1);
      expect(
        (await pool.query("SELECT 1 FROM runs WHERE id=$1", [run.id])).rowCount,
      ).toBe(1);
    } finally {
      await pool.query(
        "DROP TRIGGER fail_cleanup ON runs; DROP FUNCTION fail_cleanup()",
      );
    }
    expect(await cleanupExpiredRuns()).toEqual({ deletedRuns: 1 });
  });
});
