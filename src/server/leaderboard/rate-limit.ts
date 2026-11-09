import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { GameError } from "@/server/game/errors";

const policies = {
  page: {
    fallback: 600,
    env: "LEADERBOARD_PAGES_PER_MINUTE",
    count: "page_requests",
    window: "page_window",
  },
  eligibility: {
    fallback: 30,
    env: "LEADERBOARD_ELIGIBILITY_PER_MINUTE",
    count: "eligibility_requests",
    window: "eligibility_window",
  },
  claim: {
    fallback: 10,
    env: "LEADERBOARD_CLAIMS_PER_MINUTE",
    count: "claim_requests",
    window: "claim_window",
  },
} as const;

export class LeaderboardRateLimitError extends GameError {
  constructor(public retryAfter: number) {
    super("RATE_LIMITED", 429);
  }
}

/** Admission commits separately: rejected requests and failed work consume budget. */
export async function limitLeaderboard(
  budget:
    | { operation: "page" }
    | { operation: "eligibility" | "claim"; ownerId: string },
) {
  const policy = policies[budget.operation];
  const raw = process.env[policy.env];
  if (raw !== undefined && !/^[1-9][0-9]{0,5}$/.test(raw))
    throw new Error("Invalid leaderboard request budget configuration");
  const limit = raw === undefined ? policy.fallback : Number(raw);
  // Identifiers come only from these fixed policies, never request data.
  const count = sql.identifier(policy.count);
  const window = sql.identifier(policy.window);
  const table = sql.identifier(
    budget.operation === "page" ? "global_game_stats" : "sessions",
  );
  const owner =
    budget.operation === "page"
      ? sql`id = 1`
      : sql`id = ${budget.ownerId} and revoked_at is null and expires_at > statement_timestamp()`;
  const result = await getDatabase().execute<{
    requests: number;
    retryAfter: number;
  }>(sql`
    update ${table} set
      ${count} = case when ${window} <= statement_timestamp()
        then 1 else least(${count} + 1, ${limit + 1}) end,
      ${window} = case when ${window} <= statement_timestamp()
        then statement_timestamp() + interval '1 minute' else ${window} end
    where ${owner}
    returning ${count} as requests,
      least(60, greatest(1, ceil(extract(epoch from (${window} - statement_timestamp())))))::integer as "retryAfter"
  `);
  const row = result.rows[0];
  if (!row) {
    if (budget.operation !== "page")
      throw new GameError("SESSION_REQUIRED", 401);
    throw new Error("Missing global request budget");
  }
  if (row.requests > limit) throw new LeaderboardRateLimitError(row.retryAfter);
}
