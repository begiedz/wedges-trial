CREATE TABLE "global_game_stats" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"completed_games" bigint DEFAULT 0 NOT NULL,
	"abandoned_games" bigint DEFAULT 0 NOT NULL,
	"opened_chests" bigint DEFAULT 0 NOT NULL,
	"moves" bigint DEFAULT 0 NOT NULL,
	"invalid_moves" bigint DEFAULT 0 NOT NULL,
	"broken_picks" bigint DEFAULT 0 NOT NULL,
	"ore_nuggets" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "global_game_stats_singleton" CHECK ("global_game_stats"."id" = 1),
	CONSTRAINT "global_game_stats_nonnegative" CHECK ("global_game_stats"."completed_games" >= 0 and "global_game_stats"."abandoned_games" >= 0 and "global_game_stats"."opened_chests" >= 0 and "global_game_stats"."moves" >= 0 and "global_game_stats"."invalid_moves" >= 0 and "global_game_stats"."broken_picks" >= 0 and "global_game_stats"."ore_nuggets" >= 0)
);
--> statement-breakpoint
-- Serialize legacy run writers through the backfill and trigger installation.
LOCK TABLE runs IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT "leaderboard_entries_run_id_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "owner_id" uuid DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "ruleset_version" text DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "ore_nuggets" bigint DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "opened_chests" integer DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "finished_at" timestamp with time zone DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "total_metrics" jsonb DEFAULT NULL;--> statement-breakpoint
-- The previous trigger rejects updates, including this one-time authoritative backfill.
DROP TRIGGER leaderboard_guard_claim ON leaderboard_entries;
--> statement-breakpoint
UPDATE leaderboard_entries AS entry SET
  owner_id = run.owner_id,
  ruleset_version = run.ruleset_version,
  ore_nuggets = run.ore_nuggets,
  opened_chests = run.opened_chests,
  finished_at = run.finished_at,
  total_metrics = run.game->'totalMetrics'
FROM runs AS run WHERE run.id = entry.run_id AND run.status = 'finished';
--> statement-breakpoint
ALTER TABLE leaderboard_entries
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN ruleset_version SET NOT NULL,
  ALTER COLUMN ore_nuggets SET NOT NULL,
  ALTER COLUMN opened_chests SET NOT NULL,
  ALTER COLUMN finished_at SET NOT NULL,
  ALTER COLUMN total_metrics SET NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_leaderboard_claim() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_run runs%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Leaderboard claims are durable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO source_run FROM runs WHERE id = NEW.run_id AND status = 'finished' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only finished runs may be claimed' USING ERRCODE = '23514';
  END IF;
  -- Caller-supplied result columns can never override authoritative scores.
  NEW.owner_id := source_run.owner_id;
  NEW.ruleset_version := source_run.ruleset_version;
  NEW.ore_nuggets := source_run.ore_nuggets;
  NEW.opened_chests := source_run.opened_chests;
  NEW.finished_at := source_run.finished_at;
  NEW.total_metrics := source_run.game->'totalMetrics';
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER leaderboard_guard_claim BEFORE INSERT OR UPDATE OR DELETE ON leaderboard_entries
FOR EACH ROW EXECUTE FUNCTION guard_leaderboard_claim();
--> statement-breakpoint
CREATE INDEX "leaderboard_entries_ranking" ON "leaderboard_entries" USING btree ("ruleset_version","ore_nuggets" DESC NULLS LAST,"opened_chests" DESC NULLS LAST,"finished_at","run_id");--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_result_valid" CHECK ((
      "leaderboard_entries"."ore_nuggets" >= 0 and "leaderboard_entries"."opened_chests" >= 0
      and ("leaderboard_entries"."total_metrics"->>'moves')::bigint >= 0
      and ("leaderboard_entries"."total_metrics"->>'invalidMoves')::bigint >= 0
      and ("leaderboard_entries"."total_metrics"->>'brokenPicks')::bigint >= 0
    ) is true);
--> statement-breakpoint
-- Existing retained terminal runs count once. Earlier already-deleted games are unknown.
INSERT INTO global_game_stats (
  id, completed_games, abandoned_games, opened_chests, moves,
  invalid_moves, broken_picks, ore_nuggets
)
SELECT 1,
  count(*) FILTER (WHERE status = 'finished'),
  count(*) FILTER (WHERE status = 'abandoned'),
  coalesce(sum((game->>'openedChests')::bigint), 0),
  coalesce(sum((game->'totalMetrics'->>'moves')::bigint), 0),
  coalesce(sum((game->'totalMetrics'->>'invalidMoves')::bigint), 0),
  coalesce(sum((game->'totalMetrics'->>'brokenPicks')::bigint), 0),
  coalesce(sum(ore_nuggets), 0)
FROM runs WHERE status IN ('finished', 'abandoned');
--> statement-breakpoint
CREATE FUNCTION count_terminal_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('finished', 'abandoned') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('finished', 'abandoned') THEN RETURN NEW; END IF;
  INSERT INTO global_game_stats (
    id, completed_games, abandoned_games, opened_chests, moves,
    invalid_moves, broken_picks, ore_nuggets
  ) VALUES (
    1, CASE WHEN NEW.status = 'finished' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'abandoned' THEN 1 ELSE 0 END,
    (NEW.game->>'openedChests')::bigint,
    (NEW.game->'totalMetrics'->>'moves')::bigint,
    (NEW.game->'totalMetrics'->>'invalidMoves')::bigint,
    (NEW.game->'totalMetrics'->>'brokenPicks')::bigint,
    (NEW.game->'state'->>'oreNuggets')::bigint
  ) ON CONFLICT (id) DO UPDATE SET
    completed_games = global_game_stats.completed_games + EXCLUDED.completed_games,
    abandoned_games = global_game_stats.abandoned_games + EXCLUDED.abandoned_games,
    opened_chests = global_game_stats.opened_chests + EXCLUDED.opened_chests,
    moves = global_game_stats.moves + EXCLUDED.moves,
    invalid_moves = global_game_stats.invalid_moves + EXCLUDED.invalid_moves,
    broken_picks = global_game_stats.broken_picks + EXCLUDED.broken_picks,
    ore_nuggets = global_game_stats.ore_nuggets + EXCLUDED.ore_nuggets;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER runs_count_terminal AFTER INSERT OR UPDATE OF status ON runs
FOR EACH ROW EXECUTE FUNCTION count_terminal_game();
