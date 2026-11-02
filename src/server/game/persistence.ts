import { and, eq } from "drizzle-orm";
import type { getDatabase } from "@/server/db";
import { type runActions, runs, sessions } from "@/server/db/schema";
import { type Action, publicRun } from "./engine";
import { GameError } from "./errors";
import type { Command, StoredRun } from "./types";

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];
export type ReplayRecord = typeof runActions.$inferInsert;

/** Called inside the caller's transaction, before ownership/replay/version checks. */
export async function lockOwner(tx: Transaction, ownerId: string) {
  const [owner] = await tx
    .select()
    .from(sessions)
    .where(eq(sessions.id, ownerId))
    .for("update");
  if (!owner || owner.expiresAt <= new Date())
    throw new GameError("SESSION_REQUIRED", 401);
}
export async function ownedRun(
  tx: Transaction,
  ownerId: string,
  runId: string,
) {
  const [run] = await tx
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.ownerId, ownerId)));
  if (!run) throw new GameError("RUN_NOT_FOUND", 404);
  return run;
}
export function commandFingerprint(
  action: Action | "create",
  runId: string | undefined,
  input: Command,
) {
  return JSON.stringify([
    action,
    runId ?? null,
    input.expectedVersion ?? null,
    input.pinId ?? null,
    input.direction ?? null,
  ]);
}
export function replayResponse(record: ReplayRecord, fingerprint: string) {
  if (record.fingerprint !== fingerprint)
    throw new GameError("ACTION_ID_REUSED", 409);
  return { body: record.response, status: record.statusCode };
}
export function requireVersion(run: StoredRun, expected: number | undefined) {
  if (expected !== run.version)
    throw new GameError("VERSION_CONFLICT", 409, publicRun(run));
}
export async function writeRun(tx: Transaction, run: StoredRun) {
  await tx
    .update(runs)
    .set({
      version: run.version,
      status: run.status,
      game: run.game,
      updatedAt: run.updatedAt,
    })
    .where(eq(runs.id, run.id));
}
