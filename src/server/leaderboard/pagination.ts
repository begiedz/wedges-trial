import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { LeaderboardQuery, LeaderboardResponse } from "@/api/contracts";
import { RULESET_VERSION } from "@/game/ruleset";
import { getDatabase } from "@/server/db";
import { leaderboardSnapshots } from "@/server/db/schema";
import { GameError } from "@/server/game/errors";
import { readTopRuns } from "./read";

export function validateQuery(
  params: URLSearchParams,
): Required<Pick<LeaderboardQuery, "limit">> &
  Pick<LeaderboardQuery, "cursor"> {
  for (const key of params.keys()) {
    if (!["limit", "cursor"].includes(key) || params.getAll(key).length !== 1)
      throw new GameError("INVALID_REQUEST", 400);
  }
  const rawLimit = params.get("limit") ?? "25";
  if (!/^[0-9]{1,3}$/.test(rawLimit) || +rawLimit < 1 || +rawLimit > 100)
    throw new GameError("INVALID_REQUEST", 400);
  const cursor = params.get("cursor");
  if (
    cursor !== null &&
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.[1-9][0-9]{0,2}\.[a-f0-9]{64}$/.test(
      cursor,
    )
  )
    throw new GameError("INVALID_CURSOR", 400);
  return { limit: +rawLimit, ...(cursor !== null ? { cursor } : {}) };
}

type Snapshot = typeof leaderboardSnapshots.$inferSelect;
function signature(snapshot: Snapshot, offset: number) {
  return createHmac("sha256", snapshot.cursorKey)
    .update(`${snapshot.id}:${snapshot.rulesetVersion}:${offset}`)
    .digest("hex");
}
function page(
  snapshot: Snapshot,
  offset: number,
  limit: number,
): LeaderboardResponse {
  const entries = snapshot.entries.slice(offset, offset + limit);
  const end = offset + entries.length;
  return {
    rulesetVersion: snapshot.rulesetVersion,
    entries,
    nextCursor:
      end < snapshot.entries.length
        ? `${snapshot.id}.${end}.${signature(snapshot, end)}`
        : null,
  };
}

/** One SELECT freezes the ranking, including commits with earlier claim timestamps. */
export async function readLeaderboard(
  params: URLSearchParams,
): Promise<LeaderboardResponse> {
  const { limit, cursor } = validateQuery(params);
  const db = getDatabase();
  if (cursor) {
    const [id, rawOffset, mac] = cursor.split(".");
    const [snapshot] = await db
      .select()
      .from(leaderboardSnapshots)
      .where(
        and(
          eq(leaderboardSnapshots.id, id),
          eq(leaderboardSnapshots.rulesetVersion, RULESET_VERSION),
          gt(leaderboardSnapshots.expiresAt, sql`clock_timestamp()`),
        ),
      );
    const offset = +rawOffset;
    if (
      !snapshot ||
      offset >= snapshot.entries.length ||
      !timingSafeEqual(
        Buffer.from(mac, "hex"),
        Buffer.from(signature(snapshot, offset), "hex"),
      )
    )
      throw new GameError("INVALID_CURSOR", 400);
    return page(snapshot, offset, limit);
  }
  return db.transaction(async (tx) => {
    // Bounded opportunistic reclamation; no timers or process-local state.
    await tx.execute(sql`delete from leaderboard_snapshots where id in (
      select id from leaderboard_snapshots where expires_at <= clock_timestamp()
      order by expires_at limit 100 for update skip locked
    )`);
    const top = await readTopRuns(tx);
    const entries = top.map((entry, index) => {
      if (
        entry.oreNuggets === null ||
        entry.openedChests === null ||
        !entry.finishedAt
      )
        throw new Error("Invalid persisted ranking projection");
      return {
        rank: index + 1,
        runId: entry.runId,
        displayName: entry.nickname,
        oreNuggets: entry.oreNuggets,
        openedChests: entry.openedChests,
        finishedAt: entry.finishedAt.toISOString(),
      };
    });
    if (entries.length <= limit)
      return { rulesetVersion: RULESET_VERSION, entries, nextCursor: null };
    const [snapshot] = await tx
      .insert(leaderboardSnapshots)
      .values({
        id: randomUUID(),
        rulesetVersion: RULESET_VERSION,
        cursorKey: randomBytes(32).toString("hex"),
        entries,
        expiresAt: sql`clock_timestamp() + interval '15 minutes'`,
      })
      .returning();
    return page(snapshot, 0, limit);
  });
}
