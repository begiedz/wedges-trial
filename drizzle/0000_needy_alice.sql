CREATE TABLE "run_actions" (
	"owner_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"response" jsonb NOT NULL,
	"status_code" integer NOT NULL,
	CONSTRAINT "run_actions_owner_id_action_id_pk" PRIMARY KEY("owner_id","action_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"game" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_version_positive" CHECK ("runs"."version" > 0),
	CONSTRAINT "runs_status_valid" CHECK ("runs"."status" in ('playing', 'chest_opened', 'finished', 'abandoned')),
	CONSTRAINT "runs_resources_valid" CHECK (("runs"."game"->'state'->>'oreNuggets')::bigint >= 0 and ("runs"."game"->'state'->>'lockpicks')::integer >= 0 and ("runs"."game"->'state'->>'chestIndex')::integer > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "run_actions" ADD CONSTRAINT "run_actions_owner_id_sessions_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_actions" ADD CONSTRAINT "run_actions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_id_sessions_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_one_active_owner" ON "runs" USING btree ("owner_id") WHERE "runs"."status" in ('playing', 'chest_opened');