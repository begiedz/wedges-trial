import { and, eq, gt } from "drizzle-orm";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import type { getDatabase } from "@/server/db";
import { runs, sessions } from "@/server/db/schema";
import { compactResult, publicRun } from "./engine";
import { GameError } from "./errors";
import { emptyMetrics, type StoredRun } from "./types";

export type Transaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

/** Only active rows retain a puzzle. Terminal reads reconstruct the public summary. */
export function hydrateRun(row: typeof runs.$inferSelect): StoredRun {
  if (row.game) return { ...row, game: row.game };
  const result = row.result;
  if (!result || (row.status !== "finished" && row.status !== "abandoned"))
    throw new Error("Missing authoritative run state");
  const lock = {
    pins: [],
    rules: [],
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
    isSolved: false,
    isFailed: row.status === "finished",
  };
  return {
    ...row,
    game: {
      state: {
        chestIndex: result.chestIndex,
        oreNuggets: result.oreNuggets,
        lockpicks: result.lockpicks,
        currentLock: lock,
      },
      initialLock: lock,
      reward: null,
      openedChests: result.openedChests,
      chestMetrics: emptyMetrics(),
      totalMetrics: result.totalMetrics,
      finishedAt: result.finishedAt,
    },
  };
}

/** All owner mutations serialize before checking creation identity or run versions. */
export async function lockOwner(tx: Transaction, ownerId: string) {
  const [owner] = await tx
    .select()
    .from(sessions)
    .where(eq(sessions.id, ownerId))
    .for("update");
  if (!owner || owner.revokedAt || owner.expiresAt <= new Date())
    throw new GameError("SESSION_REQUIRED", 401);
  return owner;
}

export async function ownedRun(
  tx: Transaction,
  ownerId: string,
  runId: string,
) {
  const [run] = await tx
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.id, runId),
        eq(runs.ownerId, ownerId),
        gt(runs.expiresAt, new Date()),
      ),
    );
  if (!run) throw new GameError("RUN_NOT_FOUND", 404);
  return hydrateRun(run);
}

export function requireVersion(run: StoredRun, expected: number | undefined) {
  if (expected !== run.version)
    throw new GameError("VERSION_CONFLICT", 409, publicRun(run));
}

export async function writeRun(tx: Transaction, run: StoredRun) {
  const terminal = run.status === "finished" || run.status === "abandoned";
  // The database independently derives the terminal result before dropping game.
  await tx
    .update(runs)
    .set({
      version: run.version,
      status: run.status,
      game: run.game,
      result: terminal ? compactResult(run) : null,
      expiresAt: run.expiresAt,
      updatedAt: run.updatedAt,
    })
    .where(eq(runs.id, run.id));
}
