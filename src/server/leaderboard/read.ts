import { and, asc, desc, eq } from "drizzle-orm";
import { RULESET_VERSION } from "@/game/ruleset";
import { getDatabase } from "@/server/db";
import { leaderboardEntries, runs } from "@/server/db/schema";
import type { Transaction } from "@/server/game/persistence";
import { LEADERBOARD_SIZE } from "./policy";

/** Bounded read usable within the claim transaction; public pagination is separate work. */
export async function readTopRuns(
  db: Transaction | ReturnType<typeof getDatabase> = getDatabase(),
) {
  return db
    .select({
      runId: runs.id,
      nickname: leaderboardEntries.nickname,
      oreNuggets: runs.oreNuggets,
      openedChests: runs.openedChests,
      finishedAt: runs.finishedAt,
    })
    .from(runs)
    .innerJoin(leaderboardEntries, eq(leaderboardEntries.runId, runs.id))
    .where(
      and(
        eq(runs.status, "finished"),
        eq(runs.rulesetVersion, RULESET_VERSION),
      ),
    )
    .orderBy(
      desc(runs.oreNuggets),
      desc(runs.openedChests),
      asc(runs.finishedAt),
      asc(runs.id),
    )
    .limit(LEADERBOARD_SIZE);
}
