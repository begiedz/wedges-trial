CREATE TABLE "leaderboard_entries" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leaderboard_nickname_valid" CHECK (char_length("leaderboard_entries"."nickname") between 1 and 24 and "leaderboard_entries"."nickname" = btrim("leaderboard_entries"."nickname") and "leaderboard_entries"."nickname" !~ '[[:cntrl:]]')
);
--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_resources_valid";--> statement-breakpoint
ALTER TABLE "run_actions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "ore_nuggets" bigint GENERATED ALWAYS AS ((game->'state'->>'oreNuggets')::bigint) STORED;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "opened_chests" integer GENERATED ALWAYS AS ((game->>'openedChests')::integer) STORED;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_id_owner" ON "runs" USING btree ("id","owner_id");--> statement-breakpoint
ALTER TABLE "run_actions" ADD CONSTRAINT "run_actions_run_id_owner_id_runs_id_owner_id_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."runs"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_actions_run" ON "run_actions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runs_finished_ranking" ON "runs" USING btree ("ruleset_version","ore_nuggets" DESC NULLS LAST,"opened_chests" DESC NULLS LAST,"finished_at","id") WHERE "runs"."status" = 'finished';--> statement-breakpoint
CREATE INDEX "runs_owner" ON "runs" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "run_actions" ADD CONSTRAINT "run_actions_status_valid" CHECK ("run_actions"."status_code" between 200 and 299);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_document_valid" CHECK ((
      jsonb_typeof("runs"."game"->'initialLock') = 'object'
      and jsonb_typeof("runs"."game"->'state'->'currentLock') = 'object'
      and ("runs"."game"->>'openedChests')::integer >= 0
      and ("runs"."game"->'chestMetrics'->>'moves')::integer >= 0
      and ("runs"."game"->'chestMetrics'->>'invalidMoves')::integer >= 0
      and ("runs"."game"->'chestMetrics'->>'brokenPicks')::integer >= 0
      and ("runs"."game"->'totalMetrics'->>'moves')::integer >= 0
      and ("runs"."game"->'totalMetrics'->>'invalidMoves')::integer >= 0
      and ("runs"."game"->'totalMetrics'->>'brokenPicks')::integer >= 0
    ) is true);--> statement-breakpoint
UPDATE "runs" SET "finished_at" = (game->>'finishedAt')::timestamptz WHERE status = 'finished';
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_finished_valid" CHECK (("runs"."status" <> 'finished' or (
      "runs"."finished_at" is not null
      and ("runs"."game"->'state'->>'lockpicks')::integer = 0
      and ("runs"."game"->'state'->'currentLock'->>'isFailed')::boolean
    )) is true);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_resources_valid" CHECK ((("runs"."game"->'state'->>'oreNuggets')::bigint >= 0 and ("runs"."game"->'state'->>'lockpicks')::integer >= 0 and ("runs"."game"->'state'->>'chestIndex')::integer > 0) is true);
--> statement-breakpoint
-- Keep the indexed finish instant consistent with the authoritative document.
CREATE FUNCTION guard_run_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('finished', 'abandoned') THEN
    RAISE EXCEPTION 'Terminal runs are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'finished' THEN
    NEW.finished_at := (NEW.game->>'finishedAt')::timestamptz;
  ELSE
    NEW.finished_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER runs_guard_result BEFORE INSERT OR UPDATE ON runs
FOR EACH ROW EXECUTE FUNCTION guard_run_result();
--> statement-breakpoint
CREATE FUNCTION guard_leaderboard_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Leaderboard claims are durable' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM runs WHERE id = NEW.run_id AND status = 'finished' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only finished runs may be claimed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER leaderboard_guard_claim BEFORE INSERT OR UPDATE OR DELETE ON leaderboard_entries
FOR EACH ROW EXECUTE FUNCTION guard_leaderboard_claim();
