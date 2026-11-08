CREATE TABLE "leaderboard_request_budgets" (
	"key" text PRIMARY KEY NOT NULL,
	"requests" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "leaderboard_request_budgets_positive" CHECK ("leaderboard_request_budgets"."requests" > 0)
);
--> statement-breakpoint
CREATE INDEX "leaderboard_request_budgets_expiry" ON "leaderboard_request_budgets" USING btree ("expires_at");