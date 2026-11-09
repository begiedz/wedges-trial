import { and, eq, sql } from "drizzle-orm";
import type {
  LeaderboardClaimRequest,
  LeaderboardClaimResponse,
} from "@/api/contracts";
import { RULESET_VERSION } from "@/game/ruleset";
import { getDatabase } from "@/server/db";
import { leaderboardEntries } from "@/server/db/schema";
import { publicRun } from "@/server/game/engine";
import { GameError } from "@/server/game/errors";
import {
  lockOwner,
  ownedRun,
  type Transaction,
} from "@/server/game/persistence";
import type { StoredRun } from "@/server/game/types";
import { isUuid } from "@/server/game/validation";
import { qualifyRun } from "./policy";
import { readTopRuns } from "./read";

export function validateClaim(value: unknown): LeaderboardClaimRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GameError("INVALID_REQUEST", 400);
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 ||
    !isUuid(body.actionId) ||
    typeof body.nickname !== "string"
  )
    throw new GameError("INVALID_REQUEST", 400);
  const nickname = body.nickname.trim();
  if (
    !nickname ||
    [...nickname].length > 24 ||
    /[\p{Cc}\p{Cs}]/u.test(nickname)
  )
    throw new GameError("INVALID_REQUEST", 400);
  return { actionId: body.actionId, nickname };
}

async function qualification(tx: Transaction, run: StoredRun) {
  // A displaced claim still counts as claimed, even outside the bounded TOP 1000.
  const [claimed] = await tx
    .select({ runId: leaderboardEntries.runId })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.runId, run.id));
  if (claimed) return { eligible: false, reason: "already_claimed" } as const;
  const top = await readTopRuns(tx);
  return qualifyRun(
    run,
    top.map((entry) => {
      if (
        entry.oreNuggets === null ||
        entry.openedChests === null ||
        !entry.finishedAt
      )
        throw new Error("Invalid persisted ranking projection");
      return {
        runId: entry.runId,
        rulesetVersion: RULESET_VERSION,
        oreNuggets: entry.oreNuggets,
        openedChests: entry.openedChests,
        finishedAt: entry.finishedAt.toISOString(),
      };
    }),
  );
}

export async function readEligibility(ownerId: string, runId: string) {
  return getDatabase().transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    return qualification(tx, await ownedRun(tx, ownerId, runId));
  });
}

export async function claimEntry(
  ownerId: string,
  runId: string,
  value: unknown,
) {
  const input = validateClaim(value);
  return getDatabase().transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const run = await ownedRun(tx, ownerId, runId);
    const [claimed] = await tx
      .select()
      .from(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.ownerId, ownerId),
          eq(leaderboardEntries.claimActionId, input.actionId),
        ),
      );
    if (claimed) {
      if (claimed.runId !== runId || claimed.nickname !== input.nickname)
        throw new GameError("ACTION_ID_REUSED", 409);
      if (!claimed.claimedRank) throw new Error("Missing accepted claim rank");
      return {
        status: 200,
        body: {
          run: publicRun(run),
          outcome: "leaderboard_claimed" as const,
          entry: {
            runId,
            displayName: claimed.nickname,
            rank: claimed.claimedRank,
            oreNuggets: claimed.oreNuggets,
            openedChests: claimed.openedChests,
            finishedAt: claimed.finishedAt.toISOString(),
          },
        },
      };
    }
    // Serialize every claim in this cohort across owners/functions. READ COMMITTED
    // queries after this lock observe the preceding claimant's committed cutoff.
    await tx.execute(
      sql`select pg_advisory_xact_lock(1937006963, hashtext(${RULESET_VERSION}))`,
    );
    const eligible = await qualification(tx, run);
    let body: LeaderboardClaimResponse;
    if (!eligible.eligible) {
      body = {
        run: publicRun(run),
        outcome: "leaderboard_not_qualified",
        qualification: eligible,
      };
    } else {
      if (!run.game.finishedAt) throw new Error("Missing finished timestamp");
      await tx.insert(leaderboardEntries).values({
        runId,
        nickname: input.nickname,
        claimActionId: input.actionId,
        claimedRank: eligible.rank,
      });
      body = {
        run: publicRun(run),
        outcome: "leaderboard_claimed",
        entry: {
          runId,
          displayName: input.nickname,
          rank: eligible.rank,
          oreNuggets: run.game.state.oreNuggets,
          openedChests: run.game.openedChests,
          finishedAt: run.game.finishedAt,
        },
      };
    }
    return { body, status: 200 };
  });
}
