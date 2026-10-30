# Proposed Neon / PostgreSQL data model

> This is a **schema proposal** for Drizzle migrations, not a statement that the tables already exist. Final column types and index definitions should be implemented and verified in #31.

## Tables

### `players`

- `id` UUID primary key; `display_name` validated nickname; `created_at`.
- Nickname is for presentation only; it is **not** a credential and need not be globally unique unless explicitly required.

### `sessions`

- `id` UUID; `player_id` FK; `token_hash` unique; `expires_at`, `revoked_at`, timestamps.
- Store a hash of a cryptographically random bearer secret; the original secret appears only in Secure HttpOnly cookie.

### `runs`

- `id` UUID; `player_id` FK; `status` enum (`playing`, `chest_opened`, `finished`, `abandoned`); `version` integer.
- Trusted counters: `chest_index`, `ore_nuggets`, `lockpicks`, `moves_on_current_chest`, `invalid_moves_on_current_chest`, `broken_picks_on_current_chest`, plus totals for finished-run analytics.
- `current_lock` JSONB and `initial_lock` JSONB (or equivalent normalized design) with validated shape.
- Optional trusted `optimal_solution_length`, computed by verified solver; `ruleset_version` for fair ranking after balance changes.
- `created_at`, `updated_at`, `finished_at`; consider a partial unique index for one active run per player.

### `run_actions`

- `id`, `run_id` FK, `action_id`, `action_type`, `version_before`/`version_after`, committed response or a compact replay record, `created_at`.
- Unique `(run_id, action_id)`, with additional guard against reusing the same key for different payloads.
- Add pruning/retention policy after validating replay-window requirements.

## Invariants

- Ore, chest number, picks, moves and penalties are never modified directly by caller-provided values.
- Never allow negative resource counts; enforce constraints in SQL where practical.
- One reward and one next-chest transition per solved chest, even for concurrent/retried requests.
- A finished run is immutable for scoring; abandoned and incomplete runs do not appear in the ranking.
- For ranking, choose each player's **best finished run** under currently proposed scoring semantics; stable tie breakers and bounded pages.
- Index run ownership/status; add leaderboard query indexes based on actual SQL and explain plans.
- Passwords are not required for anonymous-only MVP; do not build unused OAuth/account infrastructure.

## Data flow

Existing browser `localStorage` is untrusted. **Do not migrate local saves into a ranked, server-verified score**. If a legacy migration is later desired, keep migrated results outside competitive ranking unless independently validated.
