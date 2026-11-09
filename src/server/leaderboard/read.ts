import { asc, desc, eq } from "drizzle-orm";
import { RULESET_VERSION } from "@/game/ruleset";
import { getDatabase } from "@/server/db";
import { leaderboardEntries } from "@/server/db/schema";
import type { Transaction } from "@/server/game/persistence";
import { LEADERBOARD_SIZE } from "./policy";

/** Shared bounded projection for claim qualification and public live pages. */
export async function readTopRuns(
  db: Transaction | ReturnType<typeof getDatabase> = getDatabase(),
  limit = LEADERBOARD_SIZE,
  offset = 0,
) {
  return db
    .select({
      runId: leaderboardEntries.runId,
      nickname: leaderboardEntries.nickname,
      oreNuggets: leaderboardEntries.oreNuggets,
      openedChests: leaderboardEntries.openedChests,
      finishedAt: leaderboardEntries.finishedAt,
    })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.rulesetVersion, RULESET_VERSION))
    .orderBy(
      desc(leaderboardEntries.oreNuggets),
      desc(leaderboardEntries.openedChests),
      asc(leaderboardEntries.finishedAt),
      asc(leaderboardEntries.runId),
    )
    .limit(Math.min(limit, LEADERBOARD_SIZE - offset))
    .offset(offset);
}
