# Backend and transport

Gameplay is implemented in one Next.js application on Vercel, using Neon PostgreSQL, Drizzle and the pg driver. [Deployment evidence](status.md) is tracked separately from implementation. The [API contract](api-contract.md) defines wire shapes and retry rules; public leaderboard reads are implemented under #24.

## Layers

| Layer | Responsibility |
| --- | --- |
| src/app/api/ | Thin HTTP handlers and authenticated WebSocket upgrade |
| src/server/game/ | Validation, ownership, transitions, batching, transactions and safe diagnostics |
| src/server/db/ | Drizzle schema, pg pool and Vercel pool lifecycle integration |
| src/game/ | Pure puzzle rules, generation and reward calculations |
| src/client/game/ | HTTP validation, session orchestration, socket transport, ordered queue and pure prediction |
| src/features/gameplay/ | Controls, session hook and dialogs |

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/players/session | Bootstrap/restore anonymous session; exact body {} |
| POST | /api/runs | Create run; body contains actionId |
| GET | /api/runs/current | Active owned run or null |
| GET | /api/runs/:id | Owned run, including terminal result |
| POST | /api/runs/:id/move | actionId, expectedVersion, pinId, direction |
| POST | /api/runs/:id/reset | Restore positions, preserve damage and penalties |
| POST | /api/runs/:id/continue | Credit pending reward once and generate next chest |
| POST | /api/runs/:id/abandon | End active run, discard pending reward |
| GET | /api/runs/:id/leaderboard-eligibility | Owned qualification snapshot; no reservation |
| POST | /api/runs/:id/leaderboard-entry | Owned, validated, retry-safe nickname claim; atomic cutoff recheck |
| GET | /api/leaderboard | Public frozen TOP 1000 pagination; no session, default 25/max 100 rows |
| GET (upgrade) | /api/game/socket?run=:id | Authenticated same-origin WebSocket bound to one owned run |

Reset/continue/abandon bodies contain only actionId and expectedVersion. Strict schemas reject client state and scores. All private responses use no-store. Session bootstrap, lifecycle and recovery use HTTP; the client sends rapid moves over WebSocket, with queued HTTP fallback when upgrade is unavailable. Lifecycle controls wait for pending moves to settle.

## Atomic actions

Each mutation uses a PostgreSQL transaction and locks the session row with FOR UPDATE. After ownership/expiry checks, an exact replay is returned before checking the current version/status. Reusing an action ID with a different fingerprint fails. Accepted actions update state, metrics, version and original replay response atomically; errors roll back.

WebSocket input is ordered and adjacent moves can be coalesced (up to 32) into one transaction. Each accepted move still increments version and metrics once and has its own replay record/result. The final run is written once per batch; replies follow commit. Unexpected persistence failure rolls back the whole batch. Database state, rather than a socket-local map, coordinates tabs and function instances.

The client predicts plate movement and damage immediately (using the existing `pins`/`pinId` model; see [terminology](gameplay.md#lock-component-terminology-60)). Resources, rewards, terminal status and dialogs follow committed snapshots. Reconnect retries unknown actions with their original IDs/versions; stale-version conflicts clear queued predictions and refetch the owned run. Prediction never supplies trusted state.

## Ranking integration

Private eligibility and claim endpoints are implemented under #33. They use the gameplay cookie, live owner lock and action replay namespace; claims serialize across owners with a cohort advisory transaction lock before querying the bounded TOP 1000. Claim and replay insertion commit atomically. See the [claim contract](api-contract.md#post-run-arcade-claims-implemented-under-33). No profile is created and nicknames are labels only.

Public `/api/leaderboard` reads now freeze the bounded query in PostgreSQL for 15 minutes, with signed, ruleset-bound cursors and stable ranks across pages (#24). Localized Game Over nickname entry is implemented under #34. Pure ordering/qualification (#51), claim storage and internal bounded reads (#31) underpin the private service.

## Terminal results and eligibility (#39)

The final pick's fourth invalid move sets `finished` and `game.finishedAt`, increments final counters, and persists the run together with its original action response. The timestamp is assigned once by the server, not by an eligibility read or claim. Credited ore, opened chests and total metrics form the safe terminal result; pending rewards are never supplied by the caller. The database freezes terminal rows and derives indexed score/timestamp projections from the stored game.

Exact final-action retries return the original response before version/status checks, including after refresh. A new move/reset/continue/abandon action against a finished run returns a conflict; socket batches use the same guards. Finished and abandoned runs are absent from the current-active-run lookup but remain readable by their owner while the session is valid.

The owner may query `/api/runs/:id/leaderboard-eligibility` after finish. This server-derived snapshot does not reserve a place or publish a score. Only accepted nickname claims enter ranking reads, and submission rechecks the current cutoff atomically. Playing, chest-opened and abandoned runs cannot qualify. Public ranking pagination uses durable snapshots under #24; no first-visit name is required.

Results and action replays remain available throughout the live owning session, with no earlier claim deadline. After session expiry/revocation, private access ends; manual cleanup may remove unclaimed terminal runs only after the run and all its actions pass the 30-day grace period. Claims, including displaced claims, remain durable. See [retention](data-model.md#conservative-retention-policy-31).

### Issue #39 acceptance evidence — 2026-11-05

| Criterion | Status | Evidence |
| --- | --- | --- |
| Exactly-once game over and immutable result | PASS | `tests/integration/postgres.test.ts` finalization cases exercise both HTTP action service and socket batching: injected replay-write failure rolls back the final break, concurrent identical retries commit once, fresh reads retain score/counters/timestamp, every subsequent lifecycle action conflicts, and direct SQL score updates fail. Existing engine tests check final statistics and DTO leak prevention. |
| Eligibility computed from server data | PASS | Existing policy, private service and PostgreSQL tests derive qualification from owned persisted finished runs and reject active/abandoned runs, foreign owners and caller-provided score fields. New finalization cases read eligibility before/after an actual final move. |
| Unclaimed and unqualified runs excluded from TOP 1000 | PASS | New finalization cases verify eligible unclaimed finishes are absent from `readTopRuns()`. Existing PostgreSQL bounded-read/cutoff tests exclude unclaimed, unsupported-cohort and displaced results, reject a lost qualifier's claim, and verify no entry is inserted. Public HTTP reads remain #24/#46 scope. |
| Retries and terminal status tested | PASS | Finalization cases cover concurrent and later exact replay, terminal HTTP/batch rejection, active lookup exclusion and persisted ranking projections; existing lifecycle tests cover all nine invalid moves with resets/reloads/retries. |

The runtime contract was already implemented by the gameplay migration and #31/#33; #39 adds focused transaction regression coverage and documents the integrated behavior. No schema, wire format, ruleset, UI or retention change is required. Application rollback retains immutable results, claims and action replays; no migration or data rewrite is needed.

For environments, migrations, local WebSocket testing and diagnostics, see [server setup](server-setup.md). Leaderboard HTTP request budgets are implemented under #46 in PostgreSQL, with separate global public traversal/page budgets and per-session private budgets. They return 429/Retry-After before ranking work, without changing replay/cutoff transactions. See [admission and caching](api-contract.md#leaderboard-admission-and-caching-46). Broader abuse controls, calibrated release limits, production monitoring and late-game compute budgets remain release work.

For concrete dependency directions, state ownership, flows and replay-storage growth, see [module boundaries](module-boundaries.md).

## Game Over nickname entry (#34)

Game Over first shows only the result. Continue closes that summary and opens a separate localized leaderboard modal, keyed by the server-confirmed run ID. It then fetches the private eligibility snapshot before showing a form. Playing/chest-opened screens never request a nickname. Ineligible, unsupported and previously claimed runs show an explanatory message with a new-run action.

The client trims and checks 1–24 Unicode code points and forbidden control/unpaired-surrogate characters; the existing server remains the validation and ownership authority. The POST contains only the captured nickname and a random action ID. During submission or an unknown network outcome the name is read-only; retry sends the identical payload/action ID. A definitive validation rejection allows correction with a fresh action ID. Concurrent clicks are guarded synchronously, independently of rendering. An accepted name is rendered as React text. No browser storage, profile, session bootstrap, score field or gameplay transition is added by this panel.

Changed cutoff and already-claimed replies remove the form. Expired/unavailable credentials explain that this browser cannot submit the result; the panel does not create replacement credentials. Network/timeout/malformed-response failures offer retry. Eligibility reads ignore replies after unmount; claim completions do not update an unmounted panel. A refresh uses the existing owned-run restoration and rechecks eligibility, so an already committed claim cannot be submitted again.

| Issue #34 acceptance criterion | Status | Evidence |
| --- | --- | --- |
| First visit starts without nickname/profile | PASS | Updated `tests/integration/gameplay/game-client-lifecycle.test.ts` starts anonymously with no textbox/eligibility request, then requests eligibility only after a confirmed finished move and Continue from Game Over. Existing bootstrap/session tests remain passing. |
| Only qualifying finishes submit; server validation and safe rendering | PASS | `leaderboard-claim.test.tsx` hides the form for every ineligible reason, checks invalid names and literal markup rendering. `tests/client/game/leaderboard.test.ts` verifies the intent-only body and rejects foreign/nonterminal/malformed responses. Existing policy, route and PostgreSQL tests enforce owner/finality/name validation. |
| Retries/concurrency cannot duplicate entries | PASS | Component tests preserve action ID/name after unknown commit, prevent concurrent submit and allow a new ID only after definite validation failure. PostgreSQL claim tests cover retries, shared action namespace, one claim, competing owners, atomic cutoff recheck and rollback. |
| Non-qualifying, changed cutoff, expired session and network errors | PASS | Component tests exercise all qualification reasons, submission cutoff loss, expired reads/submissions, qualification retry and unknown-commit retry. Existing PostgreSQL tests verify the cutoff race and credential isolation/expiry. |
| EN/PL/DE/RU UI and tests | PASS | Four dictionaries provide matching claim keys; parameterized component tests render every localized label/help text. Input has an associated label, validation state/help and a live status; existing dialog retains its bounded scrollable layout and keyboard behavior. |

No SQL/API/ruleset change or migration is needed. Rollback reverts the UI/client sources and dictionaries while preserving claims/results/replay records. Public ranking reads and pagination are implemented under #24; the ranking screen remains #25 work. Browser/device visual verification and deployed end-to-end verification were not performed.
