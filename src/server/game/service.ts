import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { runActions, runs } from "@/server/db/schema";
import { type Action, newRun, publicRun, transition } from "./engine";
import { GameError } from "./errors";
import {
  commandFingerprint,
  lockOwner,
  ownedRun,
  replayResponse,
  requireVersion,
  writeRun,
} from "./persistence";
import type { Command } from "./types";

export { bootstrap, findSession, SESSION_SECONDS, tokenHash } from "./session";
export async function readRun(ownerId: string, id?: string) {
  const db = getDatabase();
  if (id) {
    const [run] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), eq(runs.ownerId, ownerId)));
    if (!run) throw new GameError("RUN_NOT_FOUND", 404);
    return publicRun(run);
  }
  const [active] = await db
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.ownerId, ownerId),
        inArray(runs.status, ["playing", "chest_opened"]),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);
  return active ? publicRun(active) : null;
}
export type { Command } from "./types";
export async function execute(
  ownerId: string,
  action: Action | "create",
  id: string | undefined,
  input: Command,
) {
  // Serialize per owner, including creation and action IDs reused across different runs.
  return getDatabase().transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const owned = id ? await ownedRun(tx, ownerId, id) : undefined;
    const fingerprint = commandFingerprint(action, id, input);
    const [replay] = await tx
      .select()
      .from(runActions)
      .where(
        and(
          eq(runActions.ownerId, ownerId),
          eq(runActions.actionId, input.actionId),
        ),
      );
    if (replay) return replayResponse(replay, fingerprint);
    let response: typeof runActions.$inferInsert.response;
    let runId: string;
    if (action === "create") {
      const [current] = await tx
        .select()
        .from(runs)
        .where(
          and(
            eq(runs.ownerId, ownerId),
            inArray(runs.status, ["playing", "chest_opened"]),
          ),
        )
        .limit(1);
      if (current)
        throw new GameError("ACTIVE_RUN_EXISTS", 409, publicRun(current));
      const run = newRun(randomUUID(), ownerId);
      await tx.insert(runs).values(run);
      runId = run.id;
      response = { run: publicRun(run), outcome: "run_started" };
    } else {
      if (!owned) throw new GameError("RUN_NOT_FOUND", 404);
      requireVersion(owned, input.expectedVersion);
      const next = transition(owned, action, input);
      await writeRun(tx, next.run);
      runId = owned.id;
      response = next.response;
    }
    const status = action === "create" ? 201 : 200;
    await tx.insert(runActions).values({
      ownerId,
      actionId: input.actionId,
      runId,
      fingerprint,
      response,
      statusCode: status,
    });
    return { body: response, status };
  });
}
