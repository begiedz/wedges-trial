import { and, eq, inArray } from "drizzle-orm";
import type { MoveRequest } from "@/api/contracts";
import type { GameReply } from "@/api/realtime";
import { getDatabase } from "@/server/db";
import { runActions, runs, sessions } from "@/server/db/schema";
import { publicRun, transition } from "./engine";
import { GameError } from "./errors";

export type MoveCommit = { actionId: string } & (
  | { response: GameReply }
  | { failure: GameError }
);
/** Coalesce queued inputs into one transaction, retaining an exact replay per move. */
export async function executeMoveBatch(
  ownerId: string,
  runId: string,
  commands: MoveRequest[],
): Promise<MoveCommit[]> {
  if (!commands.length || commands.length > 32)
    throw new GameError("INVALID_REQUEST", 400);
  return getDatabase().transaction(async (tx) => {
    const [owner] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, ownerId))
      .for("update");
    if (!owner || owner.expiresAt <= new Date())
      throw new GameError("SESSION_REQUIRED", 401);
    const [initial] = await tx
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.ownerId, ownerId)));
    if (!initial) throw new GameError("RUN_NOT_FOUND", 404);
    const existing = await tx
      .select()
      .from(runActions)
      .where(
        and(
          eq(runActions.ownerId, ownerId),
          inArray(
            runActions.actionId,
            commands.map((x) => x.actionId),
          ),
        ),
      );
    const replays = new Map(existing.map((x) => [x.actionId, x]));
    const inserts: (typeof runActions.$inferInsert)[] = [];
    const results: MoveCommit[] = [];
    let run = initial;
    for (const input of commands) {
      const fingerprint = JSON.stringify([
        "move",
        runId,
        input.expectedVersion,
        input.pinId,
        input.direction,
      ]);
      try {
        const replay = replays.get(input.actionId);
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new GameError("ACTION_ID_REUSED", 409);
          results.push({ actionId: input.actionId, response: replay.response });
          continue;
        }
        if (input.expectedVersion !== run.version)
          throw new GameError("VERSION_CONFLICT", 409, publicRun(run));
        const next = transition(run, "move", input);
        run = next.run;
        const record = {
          ownerId,
          actionId: input.actionId,
          runId,
          fingerprint,
          response: next.response,
          statusCode: 200,
        };
        inserts.push(record);
        replays.set(input.actionId, record);
        results.push({ actionId: input.actionId, response: next.response });
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
        results.push({ actionId: input.actionId, failure: error });
      }
    }
    if (inserts.length) {
      await tx
        .update(runs)
        .set({
          version: run.version,
          status: run.status,
          game: run.game,
          updatedAt: run.updatedAt,
        })
        .where(eq(runs.id, run.id));
      await tx.insert(runActions).values(inserts);
    }
    return results;
  });
}
