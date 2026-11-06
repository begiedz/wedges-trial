import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RunStatus } from "@/api/contracts";
import type { StoredGame } from "@/server/game/types";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
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
    oreNuggets: bigint("ore_nuggets", { mode: "number" }).generatedAlwaysAs(
      sql`(game->'state'->>'oreNuggets')::bigint`,
    ),
    openedChests: integer("opened_chests").generatedAlwaysAs(
      sql`(game->>'openedChests')::integer`,
    ),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    game: jsonb("game").$type<StoredGame>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("runs_id_owner").on(table.id, table.ownerId),
    index("runs_finished_ranking")
      .on(
        table.rulesetVersion,
        table.oreNuggets.desc(),
        table.openedChests.desc(),
        table.finishedAt.asc(),
        table.id.asc(),
      )
      .where(sql`${table.status} = 'finished'`),
    index("runs_owner").on(table.ownerId),
    check(
      "runs_document_valid",
      sql`(
      jsonb_typeof(${table.game}->'initialLock') = 'object'
      and jsonb_typeof(${table.game}->'state'->'currentLock') = 'object'
      and (${table.game}->>'openedChests')::integer >= 0
      and (${table.game}->'chestMetrics'->>'moves')::integer >= 0
      and (${table.game}->'chestMetrics'->>'invalidMoves')::integer >= 0
      and (${table.game}->'chestMetrics'->>'brokenPicks')::integer >= 0
      and (${table.game}->'totalMetrics'->>'moves')::integer >= 0
      and (${table.game}->'totalMetrics'->>'invalidMoves')::integer >= 0
      and (${table.game}->'totalMetrics'->>'brokenPicks')::integer >= 0
    ) is true`,
    ),
    check(
      "runs_finished_valid",
      sql`(${table.status} <> 'finished' or (
      ${table.finishedAt} is not null
      and (${table.game}->'state'->>'lockpicks')::integer = 0
      and (${table.game}->'state'->'currentLock'->>'isFailed')::boolean
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
      sql`((${table.game}->'state'->>'oreNuggets')::bigint >= 0 and (${table.game}->'state'->>'lockpicks')::integer >= 0 and (${table.game}->'state'->>'chestIndex')::integer > 0) is true`,
    ),
  ],
);
export const runActions = pgTable(
  "run_actions",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => sessions.id),
    actionId: uuid("action_id").notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    fingerprint: text("fingerprint").notNull(),
    response: jsonb("response")
      .$type<{
        run: import("@/api/contracts").RunDto;
        outcome: string;
        claimedReward?: import("@/game/types").ChestReward;
        entry?: import("@/api/contracts").LeaderboardEntryDto;
        qualification?: import("@/api/contracts").LeaderboardQualification;
      }>()
      .notNull(),
    statusCode: integer("status_code").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.actionId] }),
    foreignKey({
      columns: [table.runId, table.ownerId],
      foreignColumns: [runs.id, runs.ownerId],
    }),
    index("run_actions_run").on(table.runId),
    check(
      "run_actions_status_valid",
      sql`${table.statusCode} between 200 and 299`,
    ),
  ],
);

/** Scores are always read from the referenced immutable run, never copied here. */
export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => runs.id),
    nickname: text("nickname").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "leaderboard_nickname_valid",
      sql`char_length(${table.nickname}) between 1 and 24 and ${table.nickname} = btrim(${table.nickname}) and ${table.nickname} !~ '[[:cntrl:]]'`,
    ),
  ],
);

/** Short-lived public projections; never contains ownership or gameplay secrets. */
export const leaderboardSnapshots = pgTable(
  "leaderboard_snapshots",
  {
    id: uuid("id").primaryKey(),
    rulesetVersion: text("ruleset_version").notNull(),
    cursorKey: text("cursor_key").notNull(),
    entries: jsonb("entries")
      .$type<import("@/api/contracts").LeaderboardEntryDto[]>()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("leaderboard_snapshots_expiry").on(table.expiresAt),
    check(
      "leaderboard_snapshots_bounded",
      sql`jsonb_typeof(${table.entries}) = 'array' and jsonb_array_length(${table.entries}) between 1 and 1000`,
    ),
  ],
);
