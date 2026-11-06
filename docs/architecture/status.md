# Implementation status — 2026-11-02

Gameplay has migrated from browser-owned state to server-authoritative PostgreSQL persistence. The latest implementation is on development (server migration through commit 38f5888). This does not establish production readiness or a completed leaderboard.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Gameplay | Server generation, moves, reset, rewards, continue, abandon and finalization | Difficulty calibration and late-game performance measurements |
| Persistence | Neon/PostgreSQL, Drizzle migrations, atomic versioned actions and replay records | Scheduling/monitoring of conservative manual retention |
| Identity | Anonymous hashed-token sessions; protected cookie; authenticated private eligibility, nickname claims and localized Game Over entry | Deployed expiry/reconnect checks |
| Transport | Vercel-native WebSocket, ordered inputs, immediate visual prediction and reconciliation; HTTP recovery/fallback | Deployed WebSocket performance and reconnect verification |
| Client | React adapter over a framework-independent session controller; no gameplay localStorage/sessionStorage | Ranking UI |
| Balance | Approved deterministic ore; reset and continuation preserve pick damage; endless ore ranking approved under #51 | Pick replenishment calibration and release abuse controls |
| Ranking | Finished runs/metrics, ordering policy, claim storage, internal TOP 1000 reads and atomic private eligibility/claim orchestration | Public read/cursor endpoints and ranking screen |
| Audio/assets | Existing visual assets | Provenance audit; optional music/SFX controls |

## Verification boundaries

- The committed migration was applied to the configured development Neon database. Local and development Preview HTTPS session/run flows were verified after correcting mismatched direct/pooled database targets.
- Native authenticated WebSocket upgrade and committed action were verified locally through Vercel CLI. Real WebSocket/PostgreSQL tests cover burst input, replay and rollback.
- Before commit 38f5888, 113 tests passed with the opt-in PostgreSQL suite enabled, and the production build passed. Full lint then reported pre-existing formatting/import failures; changed code passed focused checks.
- A push to development triggers a Vercel Preview build; a successful build alone is not end-to-end WebSocket verification. Production migration, production gameplay and leaderboard deployment are not established by these checks.

## Implementation entrypoints

- UI: src/features/gameplay/components/game/game-client.tsx and src/features/gameplay/hooks/use-game-session.ts.
- Client lifecycle: src/client/game/session.ts; HTTP: api.ts and response.ts.
- Client command synchronization: src/client/game/channel.ts and command-queue.ts; prediction.ts and transport.ts own pure prediction and socket lifecycle.
- HTTP and upgrade routes: src/app/api/.
- Validation, orchestration, batching: src/server/game/.
- Schema and driver: src/server/db/; committed migration history: drizzle/.
- Pure puzzle engine: src/game/; localized pages: src/app/[lang]/.

See [setup and troubleshooting](server-setup.md), [backend](backend.md), [API contract](api-contract.md) and [remaining work](roadmap.md). Old browser saves are never imported into trusted runs.

## Modularity refactor (#56)

Movement evaluation and pick damage are shared by generation/runtime/prediction; the server evaluates each move once. Action-specific transitions and shared persistence helpers retain authoritative transaction/replay boundaries. Session lifecycle is independent of React; dialogs, keyboard handling and URL synchronization remain presentation concerns. See [module boundaries and state ownership](module-boundaries.md). No database migration, retention policy, balance change or deployment is part of this refactor.

Local refactor verification on 2026-11-02: 131 tests passed; seven opt-in PostgreSQL integration tests were skipped because TEST_DATABASE_URL was unset. Type checking (`pnpm exec tsc --noEmit`), `pnpm lint` and the production build passed. Lint retains one existing custom-cursor `!important` warning; existing formatting/import errors were corrected without behavior changes. The restricted build stalled and was stopped; the build passed when rerun outside the sandbox. No live database, deployment or browser end-to-end verification was performed for this refactor.

## Competitive scoring policy (#51) — 2026-11-03

The task author approved endless ore ranking. Pure policy now projects server-finished results, orders ore/chests/finish time/UUID and evaluates dynamic TOP 100 snapshot eligibility within deterministic-ore-v1. The [ranking contract](competitive-ranking.md) documents sustain/automation risks, version boundaries and handoff requirements for #24/#34/#46/#47. Claim persistence, atomic rechecks, public endpoints and nickname UI remain unimplemented; no GitHub issue changes, migration or deployment were performed.

Local verification: 145 tests passed; seven opt-in PostgreSQL tests skipped because TEST_DATABASE_URL was unset. Type checking, lint and production build passed; lint retains the existing custom-cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No live database or browser end-to-end verification was performed for this policy-only change.

## Persistence schema (#31) — 2026-11-03

Added claim storage, one-claim/FK/name constraints, immutable terminal results, generated score projections and ranking indexes, bounded internal TOP 100 reads, session revocation checks, replay timestamps and conservative manual cleanup. Fresh migrations and upgrades of existing finished documents are exercised in disposable PostgreSQL; cleanup tests cover concurrent maintenance, live recovery, replay grace periods, active runs, durable claims and transaction rollback. Public claim/read endpoints and atomic cutoff orchestration remain #24/#46 work. No Neon or production migration, cleanup or deployment was performed.

Local #31 verification: 159 tests passed with all 14 PostgreSQL integration tests enabled, including legacy migration backfill. Fresh migration and immediate journal rerun succeeded; schema generation reports no drift. Type checking, lint and production build passed (existing cursor `!important` lint warning). PostgreSQL tests and build required execution outside the sandbox. See [acceptance evidence](data-model.md#issue-31-acceptance-evidence--2026-11-03).

## Gameplay statistics (#49) — 2026-11-04

Completed the existing authoritative chest/run metrics with verified initial-layout `optimalMoves` metadata and localized Game Over totals (moves, invalid moves, broken picks). Optima remain server-private and unavailable for construction-only fallbacks/legacy locks. Counters stay in `StoredGame`; no incompatible `RunState` change, SQL migration, score change or ruleset split is required. Historical replay replies remain compatible. See [acceptance evidence](gameplay.md#issue-49-acceptance-evidence--2026-11-04) and [data compatibility](data-model.md#statistics-compatibility-49).

Local verification: all 174 tests passed with all 15 PostgreSQL integration tests enabled against disposable local PostgreSQL 17, including real WebSocket reconnect/replay, races, reset/finalization and rollback. Type checking, lint and production build passed; lint retains the existing cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No Neon/production migration, deployment, browser end-to-end verification or GitHub issue mutation was performed.

## Deterministic reward completion (#47) — 2026-11-05

Centralized the already-approved ore parameters and documented calculation details beside `getDeterministicOre()`. At the task author's request, the reward dialog and translations retain their previous appearance, with no breakdown fields or rules in the UI. Authoritative rewards now roll picks separately from ore. No score, replenishment, ruleset or SQL schema change was made. A seeded resource simulation documents long-run sustain and ore distribution, including censored survivors and high chest indices; this is not player/difficulty calibration. See [#47 acceptance evidence and rollback](gameplay.md#reward-transparency-and-balance-evidence-47--2026-11-05).

Local #47 verification: all 198 tests passed with all 16 PostgreSQL integration tests enabled against disposable local PostgreSQL 17. Type checking, lint and production build passed; lint retains the existing custom-cursor `!important` warning. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No Neon/production migration, deployment, browser end-to-end verification or GitHub issue mutation was performed.

After the requested UI restoration, 177 tests passed and 16 opt-in PostgreSQL tests were skipped (TEST_DATABASE_URL unset). Type checking, lint and production build passed; the existing cursor warning remains. The reward dialog, dictionaries and wire contracts match their pre-#47 versions; the calculation is explained in the function comment. The earlier 198-test result above applies to the superseded breakdown implementation.

## Feature-based frontend (#57) — 2026-11-05

Gameplay React components, hooks, dialogs, controls and lock visualization now live in `src/features/gameplay/`, with colocated React tests and a minimal public API for route/layout composition. The existing debug tester belongs to `features/lock-debug`. Shared navigation takes an action slot; it no longer imports gameplay. The reused pin-selection helper belongs to `lib`. Domain, API, session controller and authoritative server behavior are unchanged; no database migration or runtime dependency was added.

`pnpm check:architecture` enforces dependency directions, feature privacy, cycles and transitive server-only dependencies. Lint/tests invoke it in local development and existing CI. Local verification: 209 tests passed; 16 PostgreSQL tests skipped (`TEST_DATABASE_URL` unset; no working local server executable). Type checking, lint and production build passed; existing cursor CSS warning remains. The sandboxed build stalled and was stopped; the build passed outside the sandbox. No browser end-to-end, live database, migration, deployment or GitHub issue mutation was performed. See [criterion-by-criterion acceptance evidence](module-boundaries.md#issue-57-acceptance-evidence--2026-11-05), including the unverified environment-dependent PostgreSQL suite.

## Filename and test conventions (#59) — 2026-11-05

Project-owned source/test filenames now use lowercase kebab-case independently of TypeScript symbols. All tests live under `tests/`, with matching source directories/basenames and explicit multi-module integration suites; this supersedes #57's temporary feature test colocation and coordinates #58's placement convention. Framework/tooling names, third-party assets and generated migration files are preserved. `pnpm check:names` enforces naming and mirroring through lint/CI and regression tests. Vitest discovers the centralized tests and provides V8 coverage through one matching development-only provider. CI adds coverage and production-build checks.

Local verification on a copied, case-sensitive Linux filesystem (Node 22): `pnpm test` and `pnpm test:coverage` each passed all 237 tests, including all 16 PostgreSQL integration tests against disposable PostgreSQL 17. Typecheck, lint and production build passed; the existing cursor CSS warning remains. Coverage maps to renamed sources (62.67% statements/lines, 87.92% branches, 78.51% functions). Syntax comparison of all 127 existing source/test modules confirmed only path/import-order changes. No gameplay, API, stored-data or symbol-naming change; no Neon/production migration, deployment, live browser check or GitHub mutation. See [criterion-by-criterion evidence and rollback](../agent/file-naming.md#issue-59-acceptance-evidence--2026-11-05).

## Anonymous sessions and private claims (#33) — 2026-11-05

Retained the existing cryptographically random 256-bit credentials, hash-only storage and fixed 30-day Secure/HttpOnly/SameSite=Strict cookie. Added private eligibility and nickname-claim routes using the same owner, Origin checks and shared action ID namespace. Owner-row locking rechecks expiry/revocation; a cohort advisory transaction lock serializes cutoff checks across sessions. Claim insertion and original replay response commit together. No score is accepted from the browser, no public profile is created, and terminal gameplay remains immutable. See [API contract](api-contract.md#post-run-arcade-claims-implemented-under-33) and [session lifecycle](security.md#anonymous-session-lifecycle-33).

| Issue #33 acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Starting gameplay never asks for nickname | PASS | Bootstrap/create HTTP tests accept `{}` / actionId only; reject nickname/profile fields. Existing React/client lifecycle tests start anonymous gameplay. No UI change. |
| Session owns runs and post-run claims securely; foreign sessions cannot claim | PASS | Real PostgreSQL and route tests reject foreign eligibility/claim requests with 404; owner can claim, replay across tabs and resume reads. Tests cover revoked owners, Origin/CSRF, forged scores, one claim, cross-operation action-ID reuse, changed-cutoff loss, concurrent owners and rollback after replay-write failure. |
| Tests cover cookie expiry, invalid token, refresh, multiple tabs and browser isolation | PASS | Protected cookie flags/lifetime and non-sliding restore tested at HTTP boundary; database-backed HTTP tests cover expired/malformed/unknown/missing credentials, repeated bootstrap/refresh, concurrent tab starts, isolated owner cookies and replacement after expiry without transferring the old run. |

No SQL migration is needed: claim replay metadata extends the existing JSONB TypeScript shape only. Application rollback can retain schema, claims and action records; do not delete durable claims or replay history. Existing manual retention protects active runs, live-session recovery/submission and claimed results; this work adds no cleanup job, TTL or production maintenance.

Local verification: all 262 tests passed, including all 19 PostgreSQL integration tests against disposable local PostgreSQL 17; coverage, type checking, lint, naming/architecture checks and production build passed. The sandbox blocked localhost database access and stalled Turbopack; database checks and the successful build ran outside the sandbox. Lint retains the existing cursor CSS warning. No live browser end-to-end, Neon/production migration, deployment or GitHub issue mutation was performed. Public leaderboard pagination and nickname UI remain #24/#34/#46 work.

## Finalization and trusted eligibility (#39) — 2026-11-05

Reviewed the existing authoritative final-move transaction, immutable terminal storage, private eligibility/claim service and conservative retention against #39. No runtime change was necessary. Added focused PostgreSQL regressions for both HTTP action execution and socket batching: rollback on final-action replay persistence failure, concurrent identical retries, stable final score/counters/timestamp, rejection of all subsequent lifecycle mutations, direct SQL immutability, active lookup exclusion and eligible unclaimed results remaining absent from ranking reads. See [criterion-by-criterion acceptance evidence](backend.md#issue-39-acceptance-evidence--2026-11-05).

Local verification: `pnpm test` and `pnpm test:coverage` each passed all 264 tests, including all 21 PostgreSQL integration tests against disposable local PostgreSQL 17. Type checking, lint (including naming/architecture checks) and production build passed; the existing cursor CSS warning remains. Database tests and the successful build ran outside the sandbox; the restricted Turbopack build stalled and was stopped. The disposable test container was removed. No browser end-to-end check, Neon/production migration, deployment or GitHub issue mutation was performed. Public leaderboard pagination and nickname UI remain separate work.

## Post-run nickname form (#34) — 2026-11-05

Finished-run Game Over now checks private server eligibility and offers nickname entry only to qualifiers, with EN/PL/DE/RU validation, pending/success states, changed-cutoff/already-claimed messages, session-expiry handling and network retry. Unknown submissions retain their exact action ID/name; synchronous guarding prevents duplicate clicks. Names render as plain text; no nickname/profile is requested before play, and no local storage or client score is introduced. Existing #33 transactions remain authoritative. See [criterion-by-criterion evidence](backend.md#game-over-nickname-entry-34).

Local verification: `pnpm test` and `pnpm test:coverage` each passed all 299 tests, including all 21 PostgreSQL integration tests against disposable local PostgreSQL 17. Type checking, lint, naming/architecture checks and production build passed; lint retains the existing cursor CSS warning. PostgreSQL tests and build ran outside the sandbox. No browser/device visual or deployed end-to-end verification, Neon/production migration, deployment or GitHub issue mutation was performed. No schema/wire/ruleset change is required; public ranking reads/pagination and the ranking screen remain #24/#46 work.

## TOP 1000 and sequential result/claim modals — 2026-11-05

The task author approved expanding qualification to the best 1000 claimed finished runs and paginated browsing. A shared capacity now drives server policy, bounded internal reads and client response validation. The atomic cutoff recheck, ordering, owner checks, durable claims and replay semantics are unchanged. Existing results remain in deterministic-ore-v1; no schema migration/backfill or score change is required.

Game Over shows statistics first; Continue closes it and opens a separate leaderboard modal, where eligibility is requested and qualifiers may enter a nickname. The four dictionaries now describe TOP 1000. The planned public contract specifies 25 entries/page by default, up to 100/request and at most 1000 per frozen cursor traversal. At the task author's explicit request, public pagination/API/snapshot storage and ranking screen remain unimplemented #24/#46 work. See [approved decision and rollback](decisions.md#approved-capacity-pagination-and-modal-flow--2026-11-05).

| Requested change | Status | Evidence |
| --- | --- | --- |
| Expand qualification to 1000 | PASS | Policy tests cover 0/99/100/999/1000/1001 claims, eligibility at rank 1000 and rejection after cutoff changes. PostgreSQL tests read exactly the best 1000 claimed results and serialize competing claims at rank 1000. Client accepts the expanded range and rejects rank 1001. |
| Define paginated leaderboard assumptions | PASS | API/competitive-ranking contract and decision ledger specify total capacity independently of page size, frozen snapshot traversal and navigation. Public implementation is explicitly out of scope. |
| Nickname prompt follows Game Over in a separate modal | PASS | Four-language `run-failed-dialog.test.tsx` verifies the result precedes eligibility, Continue replaces it with exactly one leaderboard modal, and nonqualifiers can start again without a form. The HTTP-backed gameplay lifecycle regression checks the same ordering. |

Local verification: `pnpm test` and `pnpm test:coverage` each passed all 306 tests, including all 21 PostgreSQL integration tests against disposable local PostgreSQL 17. Type checking, lint, naming/architecture checks and production build passed; lint retains the existing cursor CSS warning. Tests requiring localhost and the build ran outside the sandbox. No live browser/device visual verification, Neon/production migration, deployment or GitHub issue mutation was performed. Earlier dated entries retain the historical TOP 100 verification context; this section supersedes that capacity and the original inline #34 form.

## Lock generation benchmark (#28) — 2026-11-05

Added reproducible seeded CLI/standalone Preview tooling and retained raw engine/database measurements. All pin-count thresholds and late six-pin locks through displayed chest 10,000 were measured with 100 samples per operation in a one-CPU/2 GiB Linux Node 22 container and an actual Vercel Hobby Node 22 x64 Preview. Worst generation p95 was 81.79 ms locally and 70.09 ms in Preview; observed generation maxima were 276.23/162.97 ms respectively. The decision is GO for pure server generation at measured sequential load, without a gameplay/ruleset change or production-readiness claim. Existing #48/#50 retain difficulty calibration.

Forty warm Preview database probes measured 76.67 ms median / 79.21 ms p95 inside the function and 282.48/464.82 ms client round trip. Two six-minute idle windows each produced a new postmaster timestamp and new function instance: recovery probes took 1.28–1.63 seconds inside the function and 2.07–2.40 seconds round trip. Two samples do not establish a cold-latency p95. These read-only probes are distinct from full gameplay transactions; no database data/settings or production deployment changed. See [methodology, results, resource risks and acceptance evidence](lock-benchmarks.md).

Local tests and coverage each passed 290 tests, with 21 opt-in PostgreSQL integration tests skipped (`TEST_DATABASE_URL` unset). Type checking, lint, naming/architecture checks and the application production build passed; the existing cursor warning remains. The restricted build stalled and was stopped; the successful build, container benchmark and authorized Preview/Neon measurements ran outside the sandbox. No migration, browser end-to-end test or GitHub issue mutation was performed.

All five temporary benchmark Previews were removed after measurement; the task-created protection bypass was revoked and private temporary fixture/environment/token files were deleted. No application Preview or production alias was assigned to the fixture.

## Solver validation and difficulty survey (#50) — 2026-11-05

Added explicit found/budget-exhausted/unsolvable solver outcomes, runtime legal path replay and ephemeral generation diagnostics with a construction witness. The existing generator selection, 12 attempts, 20,000-state search cap and deterministic-ore-v1 scoring are preserved; no optimum-based penalty is added. Exhaustive small-state reference checks and 12,000 seeded generated locks establish path/optimum agreement for that corpus. The survey exposes substantial late target shortfalls (92.7% at chest 1,000; 99.1% at chest 10,000); minima remain targets rather than guarantees, with future curve decisions under #48. See [full acceptance evidence, distributions, provenance and rollback](lock-validation.md).

An isolated Vercel Preview measured 1,200 additional locks across all thresholds through chest 10,000: worst generation p95 83.70 ms, maximum 167.97 ms and process RSS 211.23 MiB, within the existing #28 investigation gates. This measures pure sequential engine work, not concurrent authoritative transactions or production readiness.

Local verification: tests and coverage each passed all 318 tests, including all 21 PostgreSQL integration tests against disposable PostgreSQL 17. Type checking, lint, names/architecture checks and production build passed; the existing cursor CSS warning remains. The sandboxed build stalled and was stopped; database checks and successful build ran outside the sandbox. A 120-lock seeded comparison confirmed unchanged generated lock values against HEAD. No live browser/device verification, Neon/production migration, production deployment or GitHub mutation was performed.

Cleanup completed: the alias-free benchmark Preview and task-created protection bypass were removed, temporary fixture/credentials deleted, and the disposable PostgreSQL container stopped/removed.


## Sliding plate terminology (#60) — 2026-11-06

EN/PL/DE/RU help, About, controls, accessible movement labels and debug copy now distinguish sliding plates from stationary pins. The [canonical glossary](gameplay.md#lock-component-terminology-60), root agent rules, relevant skills, README and architecture explanations use the same distinction. Existing identifiers, translation keys, DTOs and persisted state remain compatible; no mechanics, visuals, difficulty, scoring, schema or ruleset changed.

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Four locales distinguish plates and pins | PASS | All four dictionaries use the glossary; fixed indicators remain pins. |
| Horizontal movement replaces rotation | PASS | Instructions and movement/debug labels describe sliding plates. |
| Help, About, controls, accessibility and debug agree | PASS | Applicable dictionary values updated; existing consumers retain their keys. |
| Seven positions, middle-hole target and connected behavior | PASS | Four-language mechanism/steps explain seven holes/positions, fixed pins and opposite-direction dependencies. |
| Mechanics, visuals, model, API and difficulty unchanged | PASS | Runtime changes are limited to dictionary values; documentation explicitly preserves technical names. |
| Translation structure compatible | PASS | Compared each dictionary with HEAD and all four with each other: keys, value types and array lengths match. |
| Typecheck, lint and relevant tests pass | PASS | `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:coverage` pass; both test runs passed 297 tests, skipping 21 opt-in PostgreSQL tests because `TEST_DATABASE_URL` was unset. |

`pnpm build --webpack` passed with network access after the restricted build could not fetch the existing Google font. Lint retains the existing cursor CSS warning. No live browser/device visual check, database migration, deployment or GitHub issue mutation was performed. The subsequent agent/documentation updates change Markdown only; they do not require repeating runtime tests or the build.
