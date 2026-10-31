# Proposed Neon / PostgreSQL data model

> This is a **schema proposal** for Drizzle migrations, not a statement that the tables already exist. Final column types and index definitions should be implemented and verified in #31.

## Tables

### `sessions`

- Anonymous session ID, hashed random bearer token, expiry/revocation and timestamps. Session ownership is internal, not a public player profile. Secure HttpOnly cookie holds the bearer secret.
- No required `players` or `display_name` row when a user opens the game. Internal anonymous owner IDs are allowed solely for ownership and idempotency.

### `runs`

- UUID, anonymous owner/session reference, status (`playing`, `chest_opened`, `finished`, `abandoned`), version.
- Trusted chest, ore, pick, move/mistake counters, lock JSONB, verified solver metadata where available, ruleset version and timestamps.
- At most one active run per anonymous owner; multiple completed runs allowed.

### `run_actions`

- Mutation replay records and unique (owner, action_id) across run creation and mutations; keep enough retention/tombstones for safe idempotency.

### `leaderboard_entries`

- One claimed entry per qualifying finished run: unique `run_id` FK, validated `nickname`, `claimed_at`. Score is read from immutable server-owned run data, never from a client request.
- Names are presentation-only, need not be unique and cannot authenticate or recover sessions.

## Invariants

- Server computes score and verifies run ownership, finality, nickname and qualification at claim time.
- Public TOP 100 contains only claimed finished runs. Rank individual runs, not one best run per player.
- Fewer than 100 claimed entries: any valid finished run may qualify. Full ranking: the run must outrank the 100th under the agreed deterministic order (#51), rechecked atomically to avoid concurrency races.
- One claim per run and idempotent retries. A preliminary eligible response does not reserve a place.
- No browser storage for gameplay state; last nickname may optionally be cached for input convenience, not identity.
- Periodically prune non-qualifying/abandoned old runs only after safe retention limits; do not prune active runs, claimed leaderboard references or still-replayable actions.

## Data flow

Never import unverified old local saves into competitive ranking. Drizzle schema and migrations are planned (#31), not implemented by this document.
