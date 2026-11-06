CREATE TABLE "leaderboard_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ruleset_version" text NOT NULL,
	"cursor_key" text NOT NULL,
	"entries" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "leaderboard_snapshots_bounded" CHECK (jsonb_typeof("leaderboard_snapshots"."entries") = 'array' and jsonb_array_length("leaderboard_snapshots"."entries") between 1 and 1000)
);
--> statement-breakpoint
CREATE INDEX "leaderboard_snapshots_expiry" ON "leaderboard_snapshots" USING btree ("expires_at");