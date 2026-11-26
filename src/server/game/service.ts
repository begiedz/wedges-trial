import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { runs, sessions } from "@/server/db/schema";
import { type Action, newRun, publicRun, transition } from "./engine";
import { GameError } from "./errors";
import {
  hydrateRun,
  lockOwner,
  ownedRun,
  requireVersion,
  writeRun,
} from "./persistence";
import type { Command } from "./types";

export async function readRun(ownerId: string, id?: string) {
  const [run] = await getDatabase()
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.ownerId, ownerId),
        gt(runs.expiresAt, new Date()),
        id
          ? eq(runs.id, id)
          : inArray(runs.status, ["playing", "chest_opened"]),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);
  if (!run && id) throw new GameError("RUN_NOT_FOUND", 404);
  return run ? publicRun(hydrateRun(run)) : null;
}

export type { Command } from "./types";
export async function execute(
  ownerId: string,
  action: Action | "create",
  id: string | undefined,
  input: Command,
) {
  return getDatabase().transaction(async (tx) => {
    const owner = await lockOwner(tx, ownerId);
    if (action === "create") {
      // A creation marker outlives its payload, so a delayed retry cannot create
      // another game after the original run has expired or been cleaned up.
      const previousId = owner.creationRequests[input.actionId];
      if (previousId) {
        const run = await ownedRun(tx, ownerId, previousId);
        return {
          body: { run: publicRun(run), outcome: "run_started" },
          status: 201,
        };
      }
      // Expired active payloads must not occupy the one-active-run slot.
      await tx
        .delete(runs)
        .where(and(eq(runs.ownerId, ownerId), lte(runs.expiresAt, new Date())));
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
        throw new GameError(
          "ACTIVE_RUN_EXISTS",
          409,
          publicRun(hydrateRun(current)),
        );
      const run = newRun(randomUUID(), ownerId);
      run.createActionId = input.actionId;
      await tx.insert(runs).values(run);
      await tx
        .update(sessions)
        .set({
          creationRequests: {
            ...owner.creationRequests,
            [input.actionId]: run.id,
          },
        })
        .where(eq(sessions.id, ownerId));
      return {
        body: { run: publicRun(run), outcome: "run_started" },
        status: 201,
      };
    }
    if (!id) throw new GameError("RUN_NOT_FOUND", 404);
    const owned = await ownedRun(tx, ownerId, id);
    requireVersion(owned, input.expectedVersion);
    const next = transition(owned, action, input);
    await writeRun(tx, next.run);
    return { body: next.response, status: 200 };
  });
}
