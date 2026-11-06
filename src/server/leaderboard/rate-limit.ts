import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { leaderboardRequestBudgets } from "@/server/db/schema";
import { GameError } from "@/server/game/errors";

const policies = {
  // Global public budgets bound snapshot creation even without a trusted IP.
  snapshot: { fallback: 60, env: "LEADERBOARD_SNAPSHOTS_PER_MINUTE" },
  page: { fallback: 600, env: "LEADERBOARD_PAGES_PER_MINUTE" },
  eligibility: { fallback: 30, env: "LEADERBOARD_ELIGIBILITY_PER_MINUTE" },
  claim: { fallback: 10, env: "LEADERBOARD_CLAIMS_PER_MINUTE" },
} as const;

export class LeaderboardRateLimitError extends GameError {
  constructor(public retryAfter: number) {
    super("RATE_LIMITED", 429);
  }
}

/** Admission commits separately: rejected requests and failed work consume budget. */
export async function limitLeaderboard(
  budget:
    | { operation: "snapshot" | "page" }
    | { operation: "eligibility" | "claim"; ownerId: string },
) {
  const policy = policies[budget.operation];
  const raw = process.env[policy.env];
  if (raw !== undefined && !/^[1-9][0-9]{0,5}$/.test(raw))
    throw new Error("Invalid leaderboard request budget configuration");
  const limit = raw === undefined ? policy.fallback : Number(raw);
  const key = `${budget.operation}:${"ownerId" in budget ? budget.ownerId : "global"}`;
  const table = leaderboardRequestBudgets;
  const result = await getDatabase().transaction(async (tx) => {
    const [row] = await tx
      .insert(table)
      .values({
        key,
        requests: 1,
        expiresAt: sql`statement_timestamp() + interval '1 minute'`,
      })
      .onConflictDoUpdate({
        target: table.key,
        set: {
          requests: sql`case when ${table.expiresAt} <= statement_timestamp()
            then 1 else least(${table.requests} + 1, ${limit + 1}) end`,
          expiresAt: sql`case when ${table.expiresAt} <= statement_timestamp()
            then statement_timestamp() + interval '1 minute' else ${table.expiresAt} end`,
        },
      })
      .returning({
        requests: table.requests,
        retryAfter: sql<number>`least(60, greatest(1, ceil(extract(epoch from (${table.expiresAt} - statement_timestamp())))))::integer`,
      });
    await tx.execute(sql`delete from leaderboard_request_budgets where key in (
      select key from leaderboard_request_budgets where expires_at <= statement_timestamp()
      order by expires_at limit 100 for update skip locked
    )`);
    return row;
  });
  if (result.requests > limit)
    throw new LeaderboardRateLimitError(result.retryAfter);
}
