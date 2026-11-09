import { LEADERBOARD_SIZE, type LeaderboardResponse } from "@/api/contracts";
import { requestJson } from "./http";

export const LEADERBOARD_PAGE_SIZE = 10;

/** Read public, server-ranked entries; never infer rank or identity from a name. */
export async function getLeaderboardPage(
  pageIndex: number,
  cursor?: string,
  signal?: AbortSignal,
): Promise<LeaderboardResponse> {
  const query = new URLSearchParams({ limit: String(LEADERBOARD_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const value = await requestJson(`/api/leaderboard?${query}`, { signal });
  if (!value || typeof value !== "object")
    throw new TypeError("INVALID_RESPONSE");
  const { entries, rulesetVersion, nextCursor } = value as LeaderboardResponse;
  if (
    typeof rulesetVersion !== "string" ||
    !rulesetVersion ||
    !(
      nextCursor === null ||
      (typeof nextCursor === "string" && nextCursor.length > 0)
    ) ||
    !Array.isArray(entries) ||
    entries.length > LEADERBOARD_PAGE_SIZE ||
    entries.some(
      (entry, index) =>
        !entry ||
        typeof entry !== "object" ||
        entry.rank !== pageIndex * LEADERBOARD_PAGE_SIZE + index + 1 ||
        entry.rank > LEADERBOARD_SIZE ||
        typeof entry.runId !== "string" ||
        !entry.runId ||
        typeof entry.displayName !== "string" ||
        !entry.displayName ||
        !Number.isSafeInteger(entry.oreNuggets) ||
        entry.oreNuggets < 0 ||
        !Number.isSafeInteger(entry.openedChests) ||
        entry.openedChests < 0 ||
        typeof entry.finishedAt !== "string" ||
        !Number.isFinite(Date.parse(entry.finishedAt)),
    ) ||
    new Set(entries.map((entry) => entry.runId)).size !== entries.length ||
    (nextCursor !== null &&
      (entries.length !== LEADERBOARD_PAGE_SIZE ||
        entries.at(-1)?.rank === LEADERBOARD_SIZE))
  )
    throw new TypeError("INVALID_RESPONSE");
  return { entries, rulesetVersion, nextCursor };
}
