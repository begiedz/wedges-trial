import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RunStatus } from "@/api/contracts";
import type { StoredGame, StoredResult } from "@/server/game/types";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  creationRequests: jsonb("creation_requests")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  eligibilityRequests: integer("eligibility_requests").notNull().default(0),
  eligibilityWindow: timestamp("eligibility_window", { withTimezone: true })
    .notNull()
    .defaultNow(),
  claimRequests: integer("claim_requests").notNull().default(0),
  claimWindow: timestamp("claim_window", { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => sessions.id),
    version: integer("version").notNull(),
    status: text("status").$type<RunStatus>().notNull(),
    rulesetVersion: text("ruleset_version").notNull(),
    oreNuggets: bigint("ore_nuggets", { mode: "number" }).notNull().default(0),
    openedChests: integer("opened_chests").notNull().default(0),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    game: jsonb("game").$type<StoredGame>(),
    result: jsonb("result").$type<StoredResult>(),
    createActionId: uuid("create_action_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("runs_id_owner").on(table.id, table.ownerId),
    index("runs_owner").on(table.ownerId),
    index("runs_expiry").on(table.expiresAt),
    uniqueIndex("runs_owner_create_action").on(
      table.ownerId,
      table.createActionId,
    ),
    check(
      "runs_document_valid",
      sql`(
      (${table.status} in ('playing', 'chest_opened')
        and ${table.result} is null
        and jsonb_typeof(${table.game}->'initialLock') = 'object'
        and jsonb_typeof(${table.game}->'state'->'currentLock') = 'object'
        and (${table.game}->>'openedChests')::integer >= 0
        and (${table.game}->'chestMetrics'->>'moves')::bigint >= 0
        and (${table.game}->'chestMetrics'->>'invalidMoves')::bigint >= 0
        and (${table.game}->'chestMetrics'->>'brokenPicks')::bigint >= 0
        and (${table.game}->'totalMetrics'->>'moves')::bigint >= 0
        and (${table.game}->'totalMetrics'->>'invalidMoves')::bigint >= 0
        and (${table.game}->'totalMetrics'->>'brokenPicks')::bigint >= 0)
      or (${table.status} in ('finished', 'abandoned')
        and ${table.game} is null
        and jsonb_typeof(${table.result}) = 'object'
        and (${table.result}->>'difficulty')::integer between 1 and 4
        and (${table.result}->'totalMetrics'->>'moves')::bigint >= 0
        and (${table.result}->'totalMetrics'->>'invalidMoves')::bigint >= 0
        and (${table.result}->'totalMetrics'->>'brokenPicks')::bigint >= 0)
    ) is true`,
    ),
    check(
      "runs_finished_valid",
      sql`(${table.status} <> 'finished' or (
      ${table.finishedAt} is not null
      and (${table.result}->>'lockpicks')::integer = 0
      and (${table.result}->>'finishedAt')::timestamptz = ${table.finishedAt}
    )) is true`,
    ),
    uniqueIndex("runs_one_active_owner")
      .on(table.ownerId)
      .where(sql`${table.status} in ('playing', 'chest_opened')`),
    check("runs_version_positive", sql`${table.version} > 0`),
    check(
      "runs_status_valid",
      sql`${table.status} in ('playing', 'chest_opened', 'finished', 'abandoned')`,
    ),
    check(
      "runs_resources_valid",
      sql`(
      ${table.oreNuggets} >= 0 and ${table.openedChests} >= 0
      and case when ${table.game} is not null then
        (${table.game}->'state'->>'oreNuggets')::bigint = ${table.oreNuggets}
        and (${table.game}->>'openedChests')::integer = ${table.openedChests}
        and (${table.game}->'state'->>'lockpicks')::integer >= 0
        and (${table.game}->'state'->>'chestIndex')::integer > 0
      else
        (${table.result}->>'oreNuggets')::bigint = ${table.oreNuggets}
        and (${table.result}->>'openedChests')::integer = ${table.openedChests}
        and (${table.result}->>'lockpicks')::integer >= 0
        and (${table.result}->>'chestIndex')::integer > 0
      end
    ) is true`,
    ),
  ],
);

/** Compact immutable result, populated from the authoritative run by the insert trigger. */
export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    runId: uuid("run_id").primaryKey(),
    // NULL defaults allow old insert shapes; the trigger fills every result field.
    ownerId: uuid("owner_id").notNull().default(sql`NULL`),
    rulesetVersion: text("ruleset_version").notNull().default(sql`NULL`),
    oreNuggets: bigint("ore_nuggets", { mode: "number" })
      .notNull()
      .default(sql`NULL`),
    openedChests: integer("opened_chests").notNull().default(sql`NULL`),
    finishedAt: timestamp("finished_at", { withTimezone: true })
      .notNull()
      .default(sql`NULL`),
    totalMetrics: jsonb("total_metrics")
      .$type<StoredGame["totalMetrics"]>()
      .notNull()
      .default(sql`NULL`),
    nickname: text("nickname").notNull(),
    claimActionId: uuid("claim_action_id"),
    claimedRank: integer("claimed_rank"),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("leaderboard_entries_owner_claim_action").on(
      table.ownerId,
      table.claimActionId,
    ),
    check(
      "leaderboard_claim_rank_valid",
      sql`${table.claimedRank} is null or ${table.claimedRank} between 1 and 1000`,
    ),
    index("leaderboard_entries_ranking").on(
      table.rulesetVersion,
      table.oreNuggets.desc(),
      table.openedChests.desc(),
      table.finishedAt.asc(),
      table.runId.asc(),
    ),
    check(
      "leaderboard_result_valid",
      sql`(
      ${table.oreNuggets} >= 0 and ${table.openedChests} >= 0
      and (${table.totalMetrics}->>'moves')::bigint >= 0
      and (${table.totalMetrics}->>'invalidMoves')::bigint >= 0
      and (${table.totalMetrics}->>'brokenPicks')::bigint >= 0
    ) is true`,
    ),
    check(
      "leaderboard_nickname_valid",
      sql`char_length(${table.nickname}) between 1 and 24 and ${table.nickname} = btrim(${table.nickname}) and ${table.nickname} !~ '[[:cntrl:]]'`,
    ),
  ],
);

/** One aggregate row: no per-game telemetry or move history. */
export const globalGameStats = pgTable(
  "global_game_stats",
  {
    id: integer("id").primaryKey().default(1),
    pageRequests: integer("page_requests").notNull().default(0),
    pageWindow: timestamp("page_window", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedGames: bigint("completed_games", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    abandonedGames: bigint("abandoned_games", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    openedChests: bigint("opened_chests", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    moves: bigint("moves", { mode: "bigint" }).notNull().default(sql`0`),
    invalidMoves: bigint("invalid_moves", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    brokenPicks: bigint("broken_picks", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    oreNuggets: bigint("ore_nuggets", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
  },
  (table) => [
    check("global_game_stats_singleton", sql`${table.id} = 1`),
    check(
      "global_game_stats_nonnegative",
      sql`${table.completedGames} >= 0 and ${table.abandonedGames} >= 0 and ${table.openedChests} >= 0 and ${table.moves} >= 0 and ${table.invalidMoves} >= 0 and ${table.brokenPicks} >= 0 and ${table.oreNuggets} >= 0`,
    ),
  ],
);
