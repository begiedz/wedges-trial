# PostgreSQL data model

The implemented schema is [src/server/db/schema.ts](../../src/server/db/schema.ts). Versioned SQL, journal and snapshots are committed under drizzle/. The configured development Neon database has been migrated; other environments require an explicit migration step. See [setup](server-setup.md).

## Implemented tables

| Table | Stored fields and constraints |
| --- | --- |
| sessions | UUID primary key, unique SHA-256 token_hash, expires_at and created_at. The raw 256-bit bearer token exists only in the cookie. |
| runs | UUID primary key, owner_id foreign key to sessions, positive version, checked status, ruleset_version, typed game JSONB, created_at/updated_at. Partial unique index permits only one playing/chest_opened run per owner. Resource/chest bounds are checked. |
| run_actions | Composite primary key (owner_id, action_id), run_id foreign key, request fingerprint, original response JSONB and HTTP status code. IDs are unique across creation and mutations for an owner. |

The game document contains current RunState, initial lock, pending reward, opened-chest count, per-chest and run-total moves/invalidMoves/brokenPicks, and finishedAt. It does not currently store a verified optimal solution. Public DTOs omit the initial lock, internal owner/session fields and solver metadata; public movement rules support visual prediction.

## Transactions and recovery

Mutations lock the owner session row, recheck expiry, authorize the run and check replay before version/status. Run changes and original responses commit together. Batched WebSocket moves preserve individual action records and versions within one transaction. Finished/abandoned gameplay is immutable; reading it does not resume an active run.

No browser save is imported. No automatic cleanup is implemented. Keep sessions, runs and replay records while recovery/retries are possible. A future retention policy must preserve active ownership, replay safety and claimed ranking references.

## Planned ranking schema

There is no players or leaderboard_entries table today. Anonymous play requires no profile. The target leaderboard entry references one immutable finished run, with a validated nickname and claim timestamp; run_id must be unique. Names are neither unique identities nor authentication.

Qualification and claim must atomically recheck the current TOP 100 cutoff. Public results contain claimed runs only, rather than each owner's best score. Ranking order is approved under #51: ore DESC, opened chests DESC, finished_at ASC, run UUID ASC, within one ruleset. Retain displaced claims with a unique run_id and query only the first 100; cursor snapshot storage and safe retention still require implementation decisions. See [competitive ranking](competitive-ranking.md).
