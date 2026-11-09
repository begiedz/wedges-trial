import type { LeaderboardQuery, LeaderboardResponse } from "@/api/contracts";
import { RULESET_VERSION } from "@/game/ruleset";
import { GameError } from "@/server/game/errors";
import { LEADERBOARD_SIZE } from "./policy";
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
    (!/^[1-9][0-9]{0,2}$/.test(cursor) || Number(cursor) >= LEADERBOARD_SIZE)
  )
    throw new GameError("INVALID_CURSOR", 400);
  return { limit: +rawLimit, ...(cursor !== null ? { cursor } : {}) };
}

/** Each page reads the current TOP 1000; new claims may shift later pages. */
export async function readLeaderboard(
  params: URLSearchParams,
): Promise<LeaderboardResponse> {
  const { limit, cursor } = validateQuery(params);
  const offset = cursor === undefined ? 0 : Number(cursor);
  const top = await readTopRuns(undefined, limit + 1, offset);
  const entries = top.slice(0, limit).map((entry, index) => {
    if (
      entry.oreNuggets === null ||
      entry.openedChests === null ||
      !entry.finishedAt
    )
      throw new Error("Invalid persisted ranking projection");
    return {
      rank: offset + index + 1,
      runId: entry.runId,
      displayName: entry.nickname,
      oreNuggets: entry.oreNuggets,
      openedChests: entry.openedChests,
      finishedAt: entry.finishedAt.toISOString(),
    };
  });
  const end = offset + entries.length;
  return {
    rulesetVersion: RULESET_VERSION,
    entries,
    nextCursor: top.length > limit ? String(end) : null,
  };
}
