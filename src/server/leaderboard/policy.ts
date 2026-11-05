import type { LeaderboardQualification } from "@/api/contracts";
import { RULESET_VERSION } from "@/game/ruleset";
import type { StoredRun } from "@/server/game/types";

export const LEADERBOARD_SIZE = 100;

/** Derived only from persisted finished runs, never from request bodies. */
export type RankedRun = {
  runId: string;
  rulesetVersion: string;
  oreNuggets: number;
  openedChests: number;
  finishedAt: string;
};

export function rankableRun(run: StoredRun): RankedRun | null {
  const { state, openedChests, finishedAt } = run.game;
  if (
    run.status !== "finished" ||
    !state.currentLock.isFailed ||
    state.lockpicks !== 0 ||
    !finishedAt ||
    !Number.isFinite(Date.parse(finishedAt)) ||
    !Number.isSafeInteger(state.oreNuggets) ||
    state.oreNuggets < 0 ||
    !Number.isSafeInteger(openedChests) ||
    openedChests < 0
  )
    return null;

  return {
    runId: run.id,
    rulesetVersion: run.rulesetVersion,
    oreNuggets: state.oreNuggets,
    openedChests,
    finishedAt,
  };
}

/** Negative means a ranks ahead of b. UUID order matches PostgreSQL UUID order. */
export function compareRankedRuns(a: RankedRun, b: RankedRun): number {
  if (a.rulesetVersion !== b.rulesetVersion)
    throw new Error("Cannot compare different scoring rulesets");
  return (
    b.oreNuggets - a.oreNuggets ||
    b.openedChests - a.openedChests ||
    Date.parse(a.finishedAt) - Date.parse(b.finishedAt) ||
    (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0)
  );
}

export type Qualification = LeaderboardQualification;

/**
 * Snapshot only: caller must authorize ownership and repeat this check inside
 * the claim transaction. claimedRuns contains unique, persisted claims,
 * including displaced claims so a run can never claim twice.
 */
export function qualifyRun(
  run: StoredRun,
  claimedRuns: readonly RankedRun[],
): Qualification {
  const candidate = rankableRun(run);
  if (!candidate) return { eligible: false, reason: "invalid_run" };
  if (candidate.rulesetVersion !== RULESET_VERSION)
    return { eligible: false, reason: "unsupported_ruleset" };
  if (claimedRuns.some((entry) => entry.runId === candidate.runId))
    return { eligible: false, reason: "already_claimed" };
  const rank =
    1 +
    claimedRuns.filter(
      (entry) =>
        entry.rulesetVersion === candidate.rulesetVersion &&
        compareRankedRuns(entry, candidate) < 0,
    ).length;
  return rank <= LEADERBOARD_SIZE
    ? { eligible: true, rank }
    : { eligible: false, reason: "below_cutoff" };
}
