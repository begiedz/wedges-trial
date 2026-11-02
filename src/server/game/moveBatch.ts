import { and, eq, inArray } from "drizzle-orm";
import type { MoveRequest } from "@/api/contracts";
import type { GameReply } from "@/api/realtime";
import { getDatabase } from "@/server/db";
import { runActions } from "@/server/db/schema";
import { transition } from "./engine";
import { GameError } from "./errors";
import {
  commandFingerprint,
  lockOwner,
  ownedRun,
  type ReplayRecord,
  replayResponse,
  requireVersion,
  writeRun,
} from "./persistence";

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
    await lockOwner(tx, ownerId);
    const initial = await ownedRun(tx, ownerId, runId);
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
    const replays = new Map<string, ReplayRecord>(
      existing.map((x) => [x.actionId, x]),
    );
    const inserts: (typeof runActions.$inferInsert)[] = [];
    const results: MoveCommit[] = [];
    let run = initial;
    for (const input of commands) {
      const fingerprint = commandFingerprint("move", runId, input);
      try {
        const replay = replays.get(input.actionId);
        if (replay) {
          replayResponse(replay, fingerprint);
          results.push({ actionId: input.actionId, response: replay.response });
          continue;
        }
        requireVersion(run, input.expectedVersion);
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
      await writeRun(tx, run);
      await tx.insert(runActions).values(inserts);
    }
    return results;
  });
}
