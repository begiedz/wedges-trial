import { sql } from "drizzle-orm";
import {
  check,
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
    game: jsonb("game").$type<StoredGame>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
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
      sql`(${table.game}->'state'->>'oreNuggets')::bigint >= 0 and (${table.game}->'state'->>'lockpicks')::integer >= 0 and (${table.game}->'state'->>'chestIndex')::integer > 0`,
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
    fingerprint: text("fingerprint").notNull(),
    response: jsonb("response")
      .$type<{
        run: import("@/api/contracts").RunDto;
        outcome: string;
        claimedReward?: import("@/game/types").ChestReward;
      }>()
      .notNull(),
    statusCode: integer("status_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.actionId] })],
);
