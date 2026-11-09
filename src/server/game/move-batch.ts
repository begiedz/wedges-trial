import type { MoveRequest } from "@/api/contracts";
import type { GameReply } from "@/api/realtime";
import { getDatabase } from "@/server/db";
import { transition } from "./engine";
import { GameError } from "./errors";
import { lockOwner, ownedRun, requireVersion, writeRun } from "./persistence";

export type MoveCommit = { actionId: string } & (
  | { response: GameReply }
  | { failure: GameError }
);
/** Commit ordered inputs once; stale retries reload current state instead of history. */
export async function executeMoveBatch(
  ownerId: string,
  runId: string,
  commands: MoveRequest[],
): Promise<MoveCommit[]> {
  if (!commands.length || commands.length > 32)
    throw new GameError("INVALID_REQUEST", 400);
  return getDatabase().transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    let run = await ownedRun(tx, ownerId, runId);
    let changed = false;
    const results: MoveCommit[] = [];
    for (const input of commands) {
      try {
        requireVersion(run, input.expectedVersion);
        const next = transition(run, "move", input);
        run = next.run;
        changed = true;
        results.push({ actionId: input.actionId, response: next.response });
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
        results.push({ actionId: input.actionId, failure: error });
      }
    }
    if (changed) await writeRun(tx, run);
    return results;
  });
}
