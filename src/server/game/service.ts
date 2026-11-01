import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import type { Direction } from "@/game/types";
import { getDatabase } from "@/server/db";
import { runActions, runs, sessions } from "@/server/db/schema";
import { type Action, newRun, publicRun, transition } from "./engine";
import { GameError } from "./errors";

export const SESSION_SECONDS = 60 * 60 * 24 * 30;
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function findSession(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await getDatabase()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  return session ?? null;
}
export async function bootstrap(token: string | undefined) {
  const existing = await findSession(token);
  if (existing) return { token: null };
  const nextToken = randomBytes(32).toString("hex");
  await getDatabase()
    .insert(sessions)
    .values({
      id: randomUUID(),
      tokenHash: tokenHash(nextToken),
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
    });
  return { token: nextToken };
}
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
export type Command = {
  actionId: string;
  expectedVersion?: number;
  pinId?: number;
  direction?: Direction;
};
export async function execute(
  ownerId: string,
  action: Action | "create",
  id: string | undefined,
  input: Command,
) {
  // Serialize per owner, including creation and action IDs reused across different runs.
  return getDatabase().transaction(async (tx) => {
    const [owner] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, ownerId))
      .for("update");
    if (!owner || owner.expiresAt <= new Date())
      throw new GameError("SESSION_REQUIRED", 401);
    const [owned] = id
      ? await tx
          .select()
          .from(runs)
          .where(and(eq(runs.id, id), eq(runs.ownerId, ownerId)))
      : [];
    if (id && !owned) throw new GameError("RUN_NOT_FOUND", 404);
    const fingerprint = JSON.stringify([
      action,
      id ?? null,
      input.expectedVersion ?? null,
      input.pinId ?? null,
      input.direction ?? null,
    ]);
    const [replay] = await tx
      .select()
      .from(runActions)
      .where(
        and(
          eq(runActions.ownerId, ownerId),
          eq(runActions.actionId, input.actionId),
        ),
      );
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        throw new GameError("ACTION_ID_REUSED", 409);
      return { body: replay.response, status: replay.statusCode };
    }
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
      if (input.expectedVersion !== owned.version)
        throw new GameError("VERSION_CONFLICT", 409, publicRun(owned));
      const next = transition(owned, action, input);
      await tx
        .update(runs)
        .set({
          version: next.run.version,
          status: next.run.status,
          game: next.run.game,
          updatedAt: next.run.updatedAt,
        })
        .where(eq(runs.id, owned.id));
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
