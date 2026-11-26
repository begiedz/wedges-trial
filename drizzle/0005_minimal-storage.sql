-- Maintenance cutover: pause old application writers before applying this migration.
-- No stored puzzle/replay history survives for terminal games.
LOCK TABLE sessions, runs, leaderboard_entries, global_game_stats IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DROP TRIGGER runs_guard_result ON runs;
--> statement-breakpoint
DROP TRIGGER runs_count_terminal ON runs;
--> statement-breakpoint
DROP TRIGGER leaderboard_guard_claim ON leaderboard_entries;
--> statement-breakpoint
ALTER TABLE runs DROP CONSTRAINT runs_document_valid;
--> statement-breakpoint
ALTER TABLE runs DROP CONSTRAINT runs_finished_valid;
--> statement-breakpoint
ALTER TABLE runs DROP CONSTRAINT runs_resources_valid;
--> statement-breakpoint
DROP INDEX runs_finished_ranking;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN ore_nuggets DROP EXPRESSION;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN ore_nuggets SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN ore_nuggets SET NOT NULL;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN opened_chests DROP EXPRESSION;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN opened_chests SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN opened_chests SET NOT NULL;
--> statement-breakpoint
ALTER TABLE runs ALTER COLUMN game DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE runs ADD COLUMN result jsonb;
--> statement-breakpoint
ALTER TABLE runs ADD COLUMN create_action_id uuid;
--> statement-breakpoint
ALTER TABLE runs ADD COLUMN expires_at timestamptz DEFAULT now() + interval '7 days' NOT NULL;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN creation_requests jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN eligibility_requests integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN eligibility_window timestamptz DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN claim_requests integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN claim_window timestamptz DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE global_game_stats ADD COLUMN page_requests integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE global_game_stats ADD COLUMN page_window timestamptz DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE leaderboard_entries ADD COLUMN claim_action_id uuid;
--> statement-breakpoint
ALTER TABLE leaderboard_entries ADD COLUMN claimed_rank integer;
--> statement-breakpoint
-- Preserve creation identity after a temporary run expires, without retaining its response.
UPDATE sessions AS owner SET creation_requests = receipt.requests
FROM (
  SELECT owner_id, jsonb_object_agg(action_id::text, run_id::text) AS requests
  FROM run_actions WHERE response->>'outcome' = 'run_started' AND status_code = 201
  GROUP BY owner_id
) AS receipt WHERE receipt.owner_id = owner.id;
--> statement-breakpoint
UPDATE runs AS run SET create_action_id = receipt.action_id
FROM (
  SELECT DISTINCT ON (run_id) run_id, action_id FROM run_actions
  WHERE response->>'outcome' = 'run_started' AND status_code = 201
  ORDER BY run_id, created_at, action_id
) AS receipt WHERE receipt.run_id = run.id;
--> statement-breakpoint
UPDATE leaderboard_entries AS entry SET
  claim_action_id = receipt.action_id,
  claimed_rank = (receipt.response->'entry'->>'rank')::integer
FROM (
  SELECT DISTINCT ON (run_id) run_id, action_id, response FROM run_actions
  WHERE response->>'outcome' = 'leaderboard_claimed'
  ORDER BY run_id, created_at, action_id
) AS receipt WHERE receipt.run_id = entry.run_id;
--> statement-breakpoint
-- Carry active admission windows into their owning rows before retiring the budget table.
UPDATE sessions AS owner SET eligibility_requests = budget.requests, eligibility_window = budget.expires_at
FROM leaderboard_request_budgets AS budget WHERE budget.key = 'eligibility:' || owner.id::text;
--> statement-breakpoint
UPDATE sessions AS owner SET claim_requests = budget.requests, claim_window = budget.expires_at
FROM leaderboard_request_budgets AS budget WHERE budget.key = 'claim:' || owner.id::text;
--> statement-breakpoint
UPDATE global_game_stats AS stats SET page_requests = budget.requests, page_window = budget.expires_at
FROM leaderboard_request_budgets AS budget WHERE stats.id = 1 AND budget.key = 'page:global';
--> statement-breakpoint
-- Derive only compact final fields, with the same difficulty policy as the domain.
CREATE FUNCTION compact_run_result(source_game jsonb, cohort text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  core_size integer;
  dependencies integer;
  tier integer;
  chest integer := (source_game->'state'->>'chestIndex')::integer;
BEGIN
  IF cohort IN ('learning-ramp-v1', 'difficulty-ore-v1', 'all-plates-v1') THEN
    WITH RECURSIVE rule_edges AS (
      SELECT DISTINCT rule.ordinal, (rule.value->>'sourcePinId')::integer AS source, (effect->>'pinId')::integer AS target
      FROM jsonb_array_elements(source_game->'initialLock'->'rules') WITH ORDINALITY AS rule(value, ordinal),
           jsonb_array_elements(rule.value->'effects') AS effect
      WHERE (rule.value->>'direction')::integer = 1
        AND (effect->>'pinId')::integer <> (rule.value->>'sourcePinId')::integer
    ), vertices AS (
      SELECT (rule->>'sourcePinId')::integer AS id
      FROM jsonb_array_elements(source_game->'initialLock'->'rules') AS rule
      UNION SELECT target FROM rule_edges
    ), edges AS (
      SELECT source, target FROM rule_edges UNION SELECT target, source FROM rule_edges
    ), reachable(origin, node) AS (
      SELECT id, id FROM vertices
      UNION
      SELECT reachable.origin, edges.target FROM reachable JOIN edges ON edges.source = reachable.node
    ), components AS (
      SELECT count(*) AS size FROM reachable GROUP BY origin
    ) SELECT coalesce((SELECT max(size) FROM components), 0), (SELECT count(*) FROM rule_edges)
      INTO core_size, dependencies;
    tier := CASE WHEN core_size >= 5 AND dependencies >= 10 THEN 4
      WHEN core_size >= 4 AND dependencies >= 6 THEN 3
      WHEN core_size >= 3 OR dependencies >= 2 THEN 2 ELSE 1 END;
  ELSE
    tier := CASE WHEN chest >= 25 THEN 4 WHEN chest >= 13 THEN 3 WHEN chest >= 6 THEN 2 ELSE 1 END;
  END IF;
  RETURN jsonb_build_object(
    'chestIndex', chest,
    'lockpicks', source_game->'state'->'lockpicks',
    'difficulty', tier,
    'oreNuggets', source_game->'state'->'oreNuggets',
    'openedChests', source_game->'openedChests',
    'totalMetrics', source_game->'totalMetrics',
    'finishedAt', source_game->'finishedAt'
  );
END;
$$;
--> statement-breakpoint
-- Statistics already counted these rows in migration 0004; do not recount.
UPDATE runs SET
  result = CASE WHEN status IN ('finished', 'abandoned') THEN compact_run_result(game, ruleset_version) ELSE NULL END,
  game = CASE WHEN status IN ('finished', 'abandoned') THEN NULL ELSE game END,
  expires_at = updated_at + CASE WHEN status IN ('finished', 'abandoned') THEN interval '24 hours' ELSE interval '7 days' END;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_run_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('finished', 'abandoned') THEN
    RAISE EXCEPTION 'Terminal runs are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.game IS NULL THEN
    RAISE EXCEPTION 'Authoritative game state is required for transitions' USING ERRCODE = '23514';
  END IF;
  NEW.ore_nuggets := (NEW.game->'state'->>'oreNuggets')::bigint;
  NEW.opened_chests := (NEW.game->>'openedChests')::integer;
  IF NEW.status IN ('finished', 'abandoned') THEN
    IF NEW.status = 'finished' AND (
      (NEW.game->'state'->>'lockpicks')::integer <> 0
      OR (NEW.game->'state'->'currentLock'->>'isFailed')::boolean IS DISTINCT FROM true
    ) THEN
      RAISE EXCEPTION 'Invalid finished game' USING ERRCODE = '23514';
    END IF;
    NEW.result := compact_run_result(NEW.game, NEW.ruleset_version);
    NEW.finished_at := CASE WHEN NEW.status = 'finished' THEN (NEW.result->>'finishedAt')::timestamptz ELSE NULL END;
    NEW.game := NULL;
    NEW.expires_at := NEW.updated_at + interval '24 hours';
  ELSE
    NEW.result := NULL;
    NEW.finished_at := NULL;
    NEW.expires_at := NEW.updated_at + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER runs_guard_result BEFORE INSERT OR UPDATE ON runs
FOR EACH ROW EXECUTE FUNCTION guard_run_result();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_leaderboard_claim() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_run runs%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Leaderboard claims are durable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO source_run FROM runs WHERE id = NEW.run_id AND status = 'finished'
    AND expires_at > statement_timestamp() FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only available finished runs may be claimed' USING ERRCODE = '23514';
  END IF;
  NEW.owner_id := source_run.owner_id;
  NEW.ruleset_version := source_run.ruleset_version;
  NEW.ore_nuggets := source_run.ore_nuggets;
  NEW.opened_chests := source_run.opened_chests;
  NEW.finished_at := source_run.finished_at;
  NEW.total_metrics := source_run.result->'totalMetrics';
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER leaderboard_guard_claim BEFORE INSERT OR UPDATE OR DELETE ON leaderboard_entries
FOR EACH ROW EXECUTE FUNCTION guard_leaderboard_claim();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION count_terminal_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('finished', 'abandoned') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('finished', 'abandoned') THEN RETURN NEW; END IF;
  UPDATE global_game_stats SET
    completed_games = completed_games + CASE WHEN NEW.status = 'finished' THEN 1 ELSE 0 END,
    abandoned_games = abandoned_games + CASE WHEN NEW.status = 'abandoned' THEN 1 ELSE 0 END,
    opened_chests = opened_chests + (NEW.result->>'openedChests')::bigint,
    moves = moves + (NEW.result->'totalMetrics'->>'moves')::bigint,
    invalid_moves = invalid_moves + (NEW.result->'totalMetrics'->>'invalidMoves')::bigint,
    broken_picks = broken_picks + (NEW.result->'totalMetrics'->>'brokenPicks')::bigint,
    ore_nuggets = ore_nuggets + (NEW.result->>'oreNuggets')::bigint
  WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Global game statistics row is missing'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER runs_count_terminal AFTER INSERT OR UPDATE OF status ON runs
FOR EACH ROW EXECUTE FUNCTION count_terminal_game();
--> statement-breakpoint
DROP TABLE run_actions;
--> statement-breakpoint
DROP TABLE leaderboard_snapshots;
--> statement-breakpoint
DROP TABLE leaderboard_request_budgets;
--> statement-breakpoint
CREATE INDEX "runs_expiry" ON "runs" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_owner_create_action" ON "runs" USING btree ("owner_id","create_action_id");--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_document_valid" CHECK ((
      ("runs"."status" in ('playing', 'chest_opened')
        and "runs"."result" is null
        and jsonb_typeof("runs"."game"->'initialLock') = 'object'
        and jsonb_typeof("runs"."game"->'state'->'currentLock') = 'object'
        and ("runs"."game"->>'openedChests')::integer >= 0
        and ("runs"."game"->'chestMetrics'->>'moves')::bigint >= 0
        and ("runs"."game"->'chestMetrics'->>'invalidMoves')::bigint >= 0
        and ("runs"."game"->'chestMetrics'->>'brokenPicks')::bigint >= 0
        and ("runs"."game"->'totalMetrics'->>'moves')::bigint >= 0
        and ("runs"."game"->'totalMetrics'->>'invalidMoves')::bigint >= 0
        and ("runs"."game"->'totalMetrics'->>'brokenPicks')::bigint >= 0)
      or ("runs"."status" in ('finished', 'abandoned')
        and "runs"."game" is null
        and jsonb_typeof("runs"."result") = 'object'
        and ("runs"."result"->>'difficulty')::integer between 1 and 4
        and ("runs"."result"->'totalMetrics'->>'moves')::bigint >= 0
        and ("runs"."result"->'totalMetrics'->>'invalidMoves')::bigint >= 0
        and ("runs"."result"->'totalMetrics'->>'brokenPicks')::bigint >= 0)
    ) is true);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_finished_valid" CHECK (("runs"."status" <> 'finished' or (
      "runs"."finished_at" is not null
      and ("runs"."result"->>'lockpicks')::integer = 0
      and ("runs"."result"->>'finishedAt')::timestamptz = "runs"."finished_at"
    )) is true);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_resources_valid" CHECK ((
      "runs"."ore_nuggets" >= 0 and "runs"."opened_chests" >= 0
      and case when "runs"."game" is not null then
        ("runs"."game"->'state'->>'oreNuggets')::bigint = "runs"."ore_nuggets"
        and ("runs"."game"->>'openedChests')::integer = "runs"."opened_chests"
        and ("runs"."game"->'state'->>'lockpicks')::integer >= 0
        and ("runs"."game"->'state'->>'chestIndex')::integer > 0
      else
        ("runs"."result"->>'oreNuggets')::bigint = "runs"."ore_nuggets"
        and ("runs"."result"->>'openedChests')::integer = "runs"."opened_chests"
        and ("runs"."result"->>'lockpicks')::integer >= 0
        and ("runs"."result"->>'chestIndex')::integer > 0
      end
    ) is true);
--> statement-breakpoint
CREATE UNIQUE INDEX leaderboard_entries_owner_claim_action ON leaderboard_entries(owner_id, claim_action_id);
--> statement-breakpoint
ALTER TABLE leaderboard_entries ADD CONSTRAINT leaderboard_claim_rank_valid CHECK (claimed_rank is null or claimed_rank between 1 and 1000);
