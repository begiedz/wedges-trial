# Repository simplification plan

Review date: 2026-11-08. Original status: **proposed**. The owner approved a constrained implementation on 2026-11-09; see [implemented scope and verification](#approved-implementation--2026-11-09) below. Historical review text follows. This document authorizes no product, wire-contract, retention-policy or balance changes. No implementation, migration, deployment or GitHub issue changes were made during the review.

## Product scope clarified by the owner

The intended product is **endless gameplay, a good playing experience and a leaderboard**. The owner reports that unwanted functionality and complexity accumulated through AI implementations without their knowledge, including an overwhelming, unreadable test suite. Existing implementation and earlier architecture documents are not evidence that every supporting feature is wanted. This clarification governs the prioritization of this plan; it does not authorize implementation or live data deletion.

Keep what players need to select and slide plates responsively, open successive chests, receive fair rewards, finish a run and view/claim a leaderboard result. Preserve existing language/accessibility support and meaningful protections for score integrity. Support refresh/recovery only to the extent needed for a reasonable player experience; the exact recovery promise remains to be defined. Measurements, elaborate diagnostics, exact historical playback and sophisticated ranking traversal must not expand the product by default.

The refactor is successful when those player flows are clear, reliable and inexpensive to maintain. A large architecture, a large test count and a high coverage percentage are not deliverables. Do not add replacement infrastructure merely to fill the space left by deleted features. Further product expansion requires an explicit owner request; implementation choices should stay proportionate to this scope.

## Assessment and scope

The principal layers have concrete jobs: a pure puzzle engine, server-authoritative transitions, transactional persistence, framework-independent client synchronization and React presentation. Within those layers, the refactor must prioritize human readability, cohesive functions and clear ownership. Removing unused surface area and duplication is only part of the work; readers should be able to follow an operation without reconstructing it across scattered helpers. Fewer files alone would not make the system simpler.

**User direction added after review.** The backend and functions throughout the repository need a deliberate readability pass. The user finds the code fragmented, insufficiently consolidated and difficult for humans to understand, with an AI-written appearance. Treat this as an explicit maintainability requirement, without making claims about code authorship. Consolidate related behavior and aggregate related results where they belong, while preserving the existing gameplay and safety contracts. This remains a plan only; do not implement the refactor as part of this task.

Three separate sub-agents reviewed the client, backend and database. The coordinating review covered domain generation/scoring, benchmarks, test organization, repository checks, CI/configuration, documentation and asset/audio status. Findings use source, import searches and regression-test inspection. Live Neon, production traffic, deployed consumers, query plans and browser/device behavior were not inspected. This is a broad static review, not a proof that every possible simplification has been found. No active GitHub issue was assigned; this plan does not claim to reconcile the live backlog.

## Reviewed execution order

The direction is sound, but the original plan mixed feature cuts, behavior-preserving cleanup and speculative redesign. This is the single execution order; numbered sections below are a finding catalog, not a competing schedule. Readability is an acceptance standard for every change, not a separate repository-wide rewrite to complete first.

| Stage | Scope | Completion / decision |
| --- | --- | --- |
| 1 | Take one small storage breakdown and identify which optional tooling will be retired | Attribute the reported size to actual tables/payloads versus baseline overhead. No permanent benchmark/telemetry system. Establish whether storage redesign is material. |
| 2 | Delete the benchmark/Preview measurement infrastructure and unused UI/dependencies; reduce their tests and fix current documentation | Remove tests for removed features. Review remaining tests for duplication, coupling and readability; preserve important player rules and score integrity. Decide whether debug UI remains before refactoring it. |
| 3 | Simplify move persistence and retention, if stage 1 confirms the benefit | Define recovery semantics and expiry before implementation. Choose the smallest safe design, update contracts, then migrate client/server and cleanup together. Measure storage again. |
| 4 | Consolidate the surviving backend/client flows for readability | Apply sections 0, 3, 4, 5 and 8 only where they reduce real duplication/navigation. Reuse the chosen retention policy in section 6; skip section 7 if debug tooling was removed. |
| 5 | Evaluate remaining product cuts separately | Live leaderboard pages are a reasonable candidate. Terminal-result schema changes, WebSocket removal, cohort retirement and SQL qualification need their own benefit/compatibility decision. Defer them if stages 2–4 solve the problem. |

Each stage consists of bounded, reviewable changes, not one large PR. Redundant-FK cleanup and optional UI state refactoring are low priority. Do not polish an abstraction that a preceding feature cut removes. No application refactor, product cut, database migration or cleanup is implemented by this plan.

## 0. Make backend flows and functions readable for humans

**Goal.** A maintainer should be able to locate an operation, read its main function in execution order and understand its inputs, decisions, side effects and result. The existing layer responsibilities remain useful; their current function shapes, forwarding exports and helper distribution are open to improvement. Passing tests and enforcing module boundaries do not establish that code is understandable.

**Starting points.** Review `src/server/game/http.ts`, `service.ts`, `move-batch.ts` and `persistence.ts` together for request-to-commit flow; review `src/server/leaderboard/service.ts`, `policy.ts` and `read.ts` together for qualification/claim flow. The duplicate error construction in item 4, forwarding exports in item 4, qualification mapping in item 8 and nested deletion orchestration in item 6 are concrete examples already identified. Extend the function-level review to `src/client/`, `src/game/`, feature hooks/components and scripts. Do not presume every small helper or separate module is unnecessary.

**Plan.**

1. Map each backend use case from entry point to result: start/resume, move, reset, continue, abandon, qualify and claim. Identify the operation's owner, transaction boundary, repeated policy, intermediate representations and helper calls that merely forward arguments. Record specific before/after examples in each proposed PR.
2. Make each orchestration function read as a clear sequence: validate input, authorize, check replay/version, compute the transition, persist, return the public result. Keep the actual lock/replay order required by the existing behavior. Use descriptive local names and explicit branches instead of dense expressions, nested ternaries, repeated casts or anonymous transformations that obscure intent.
3. Consolidate logic that changes for the same reason under one owning module. Inline trivial one-use forwarding helpers when they hide rather than explain the operation; keep named helpers for meaningful domain steps, repeated policy or independently testable transformations. Place private helpers near their callers. Avoid scattering one operation across files solely to make each file short.
4. Aggregate related outputs into explicit named result types when those values describe one decision or operation. Avoid passing fragments of the same context through long parameter lists or repeatedly rebuilding the same projection. Keep input dependencies visible; do not replace them with an all-purpose context object, mutable global state or a generic repository/service framework.
5. Keep state changes and side effects explicit. Separate pure calculations from database/network work, and make commit/rollback boundaries easy to see. Document why lock ordering, replay handling or compatibility branches exist; comments should explain constraints rather than narrate syntax.
6. Review single-action and batch persistence together for shared policy and naming. Consolidate genuinely identical policy, but preserve their distinct commit and reply semantics. Do not force both paths into a configurable executor just to remove similar-looking lines.
7. Apply the same readability standard to most functions during the staged review: clear purpose, precise inputs/results, coherent abstraction level and understandable control flow. Avoid arbitrary line-count targets, blanket helper extraction or mechanical merging. Prefer familiar functions and data structures over clever indirection.

**Delivery.** After deciding which features survive, improve one complete backend flow at a time, then qualification/claim and remaining operations. Apply the same standard to client synchronization, domain functions and retained tooling as they are touched. Do not make a broad function-by-function rewrite a prerequisite for deleting unnecessary features.

**Acceptance.**

- A reviewer unfamiliar with the implementation can explain a changed use case from its entry point, identify where authorization/replay/version checks happen and locate the commit and returned result without chasing forwarding modules.
- Each changed function has one coherent responsibility, meaningful names and explicit inputs/results; its helpers expose useful concepts. Repeated policy/projection has one clear owner. There is no new generic framework or catch-all utility module.
- Related behavior is consolidated within the appropriate layer. Domain, transport and persistence boundaries remain clear; modularity is judged by cohesion and understandable dependencies, not file/function count.
- PRs show representative before/after code and explain how the change reduces navigation, duplication or mental bookkeeping. Readability review is required alongside behavior tests; code deletion alone is insufficient evidence.
- Observable behavior, safe errors, exact replay, transaction ordering, concurrency, saved cohorts and public contracts remain unchanged. Run the applicable checks listed below for each implemented flow.

## 1. Delete unused frontend surface

**Evidence.** `src/components/ui/dropdown-menu.tsx:55` onward implements many wrappers, while `src/components/general/molecules/navbar.tsx:8` consumes only the root, trigger, content and item. The module is 272 lines. `src/components/ui/sheet.tsx:19` and `:97` define unused close/footer wrappers. The direct dependencies `@radix-ui/react-dialog`, `@radix-ui/react-navigation-menu` and `simple-icons` have no source consumers; actual Radix imports use `radix-ui`.

**Plan.** Remove unconsumed wrappers/exports and those three direct declarations using pnpm. Keep internally used primitives even when they are not imported by other files. Keep `shadcn`, whose stylesheet is imported by `src/app/globals.css:3`. Do not claim bundle savings from removing a declaration; dependencies may remain transitively.

Also replace the one-consumer button in `src/components/general/atoms/button.tsx:5` with the existing shared Button using its current navigation styling, then remove the unused `iconSrc` abstraction. Do this only if it preserves appearance without introducing a larger variants framework.

**Acceptance.** No orphan imports; clean lockfile installation, typecheck/lint/build pass; navigation retains keyboard focus, menu closing and mobile layout. While touching the sheet, address its hardcoded accessible `Close` text (`src/components/ui/sheet.tsx:77`) through localized text in all four languages. That is an incidental localization fix, not evidence for a UI redesign.

## 2. Reduce documentation duplication and stale status claims

**Evidence.** `README.md:11` describes leaderboard/claims as planned and TOP 100; `:142` describes the old chest-based ore formula; `:144` repeats outdated ranking work. `docs/architecture/roadmap.md:9` also lists implemented ranking features as next work. `docs/architecture/status.md` contains 267 lines of dated implementation/verification history, including superseded statements. Historical decisions are useful, but readers must reconstruct current truth across several documents.

**Plan.** Keep one concise current-state matrix in `status.md`, clearly separating implemented source, local evidence and deployed verification. Move chronological acceptance reports into dated archive documents, preserving links and evidence. Make README/roadmap brief summaries with links to canonical gameplay, API, deployment and status documents. Retain the decision ledger as history; mark superseded decisions instead of rewriting them as current facts. Correct stale source paths in the game-engine skill when updating that guidance.

**Acceptance.** README describes all-plates generation, tier-based ore and implemented TOP 1000 ranking accurately; pending deployment checks remain explicit. No loss of historical verification evidence. Check local links and search for obsolete current-tense claims. This is documentation consolidation, not a change to approved mechanics.

## 3. Share client request mechanics, keeping endpoint validation local

**Evidence.** `src/client/game/api.ts:9`, `src/client/game/leaderboard.ts:32` and `src/client/leaderboard.ts:14` repeat same-origin credentials, no-store caching, 15-second deadlines, JSON handling and HTTP status errors. Public ranking imports `TransportError` from gameplay (`src/client/leaderboard.ts:2`).

**Plan.** Extract a small `src/client/http.ts` JSON request function and status error. Support injected fetch, optional JSON body and composed cancellation. Keep endpoint-specific runtime DTO checks and response types in their current clients. Preserve bootstrap validation without growing a registry of endpoint schemas or a generic service/query-client framework. Add no automatic retry policy.

**Acceptance.** Existing client API suites cover unchanged status errors, invalid JSON/DTO rejection, timeouts, cancellation and Preview same-origin cookies. Unknown-commit retries retain the original action ID and body. Public ranking no longer depends on the gameplay transport-error module.

## 4. Consolidate safe errors and remove compatibility import facades

**Evidence.** Error code/status/request-ID construction repeats in `src/server/game/http.ts:107`, `src/server/game/socket.ts:22`, `src/server/leaderboard/http.ts:20` and `src/app/api/game/socket/route.ts:29`. Session functions are forwarded by `src/server/game/service.ts:17`; validation is forwarded by `src/server/game/http.ts:20` and `src/server/game/socket.ts:197`. The upgrade route imports its cookie constant through the game HTTP orchestrator.

**Plan.** Use one small server error mapper for the safe public error fields/status and allowlisted diagnostics. Adapters retain their HTTP/socket envelopes, operation-specific logging, no-store and Retry-After headers. Import session/validation implementations directly and colocate the cookie name with session policy; remove forwarding exports after migrating consumers. Avoid a route factory, dependency container or generic middleware pipeline.

**Acceptance.** Preserve conflict run/version/status fields, status codes, correlation IDs and 429 headers. Unknown exceptions never expose raw SQL, credentials or stacks. Existing HTTP/socket tests pass; add upgrade error parity coverage where missing. Typecheck and build verify import migration. No endpoint or authentication behavior changes.

## 5. Consolidate the PostgreSQL test harness

Apply the test-suite reduction below first. Share setup only across the tests that still earn their place; do not build a better framework around unnecessary suites.

**Evidence.** `tests/integration/postgres.test.ts:77`, `tests/integration/leaderboard-postgres.test.ts:71` and `tests/integration/migration-postgres.test.ts:32` each create isolated schemas/pools, load the journal, rewrite qualified schema references, apply migrations and clean up. The migration suite additionally needs temporary migration files and a separate journal schema.

**Plan.** Share explicit utilities under `tests/utils/` for isolated schema/pool lifecycle and migration fixture preparation. Keep suite-specific seeding, mock bindings, upgrade/backfill sequencing and failure injection visible in each test. Use a few functions with explicit cleanup, rather than a configurable fixture framework. Preserve the migration-runner suite's actual journal/concurrency tests; do not replace them with the gameplay suites' raw SQL loading path.

**Acceptance.** Run all three suites against disposable PostgreSQL 17, including failure cleanup, concurrent runners, legacy upgrades and rollback. Isolation and teardown work after partial setup failures. No live database is needed. Do not force parallel test execution or remove current isolation merely to shorten the harness.

## 6. Use bounded bulk deletion in manual retention

**Evidence.** `src/server/db/retention.ts:24` iterates owners, then `:35` iterates up to 100 candidate runs per owner and issues two deletes per run. With 100 owners, the configured upper bound permits roughly 20,000 run/action deletion statements, plus selection and session cleanup. This is a theoretical statement count, not measured production latency.

**Plan.** Keep owner selection and owner-first locks. For each owner, select/lock the same bounded candidate IDs, delete their actions in one parameterized statement, then delete those runs in one statement and count RETURNING rows. Retain final session cleanup. Start with per-owner batching; a single large cross-owner CTE is unnecessary unless measurement justifies it.

**Acceptance.** Preserve manual invocation, 30-day windows, active-session protection, SKIP LOCKED, recent replay protection, durable claims and transaction rollback. Verify mixed eligible/ineligible fixtures and maintenance/gameplay races in real PostgreSQL. Statement count scales with selected owners rather than candidate runs. Keep current bounds and policy; this work does not authorize scheduling or broader deletion.

## 7. Remove the competing debug continuation/reward model

**Evidence.** `src/game/create-run.ts:16` exports `openSolvedChest()`, which awards random ore through `getChestReward()` (`src/game/rewards.ts:24`). Its callers are the development debug feature and benchmark tooling/tests; authoritative server continuation uses its own transition path. `scripts/benchmark-locks.cjs:168` prepares and solves a predecessor to time this debug helper, so that metric is not authoritative server continuation latency. `createRun()` itself is used by the server and must stay.

**Plan.** Retain domain run creation. Narrow the debug tool to the lock operations it needs, or colocate its simulated continuation/reward helper with debug tooling. Share any genuinely reused pure next-lock preparation only after comparing the two paths; keep server transactions and scoring authoritative. Replace or clearly relabel the benchmark's debug continuation measurement, preserving old report provenance. Prefer measuring `createChestLock()` directly when the intended quantity is destination-lock generation.

**Acceptance.** Production domain exports no misleading general-purpose random-ore continuation API. Debug remains usable and production-gated. Authoritative continue/reset retains pick damage, cumulative penalties, deterministic ore and saved-cohort behavior. Seeded generator results and RNG consumption for saved cohorts remain unchanged. Benchmark tests/reports identify exactly which operation was measured; do not relabel historical data as server performance.

## 8. Avoid unnecessary ranking reads for invalid candidates

**Evidence.** `src/server/leaderboard/service.ts:42` checks an existing claim, then reads/maps TOP 1000 before `qualifyRun()` rejects invalid or unsupported-cohort runs (`src/server/leaderboard/policy.ts:66`).

**Plan.** Preserve the existing already-claimed reason precedence, then reject invalid/unsupported candidates using the pure rankability policy before fetching ranking rows. Keep the bounded JavaScript rank comparison for valid candidates initially. Reuse the existing rules instead of implementing a second validator.

**Acceptance.** Identical qualification reason/rank responses, durable displaced-claim handling and atomic cutoff recheck. Tests show rejected invalid/cohort candidates do not query TOP 1000. Concurrent claim, ownership, exact replay and cutoff-tie tests remain green.

## Conditional follow-ups

### Move-only WebSocket commands

The shipped channel emits only moves (`src/client/game/channel.ts:110`); session lifecycle actions use HTTP after queue idle (`src/client/game/session.ts:200`). Yet `src/api/realtime.ts:6` accepts four actions, and `src/server/game/socket.ts:93` implements mixed queue segmentation and a second dispatch path.

A move-only socket could use `MoveRequest` directly and a simple bounded splice, removing optional fields/casts and lifecycle dispatch. **This narrows documented wire behavior.** Inventory other consumers and define compatibility/retirement before removal; if support is still required, keep it. Verify HTTP lifecycle/fallback, queued-move draining, socket bursts/reconnect, old replay responses and PostgreSQL batch rollback. Keep the batching scheduler, heartbeats, backpressure and authentication.

### Redundant action foreign keys

`src/server/db/schema.ts:104` and `:108` reference sessions/runs individually while `:128` enforces `(run_id, owner_id) → runs(id, owner_id)`. Since runs already require a valid owner, the composite FK implies the individual references for these non-null columns.

Removing the two redundant references could reduce constraint bookkeeping, but the benefit is small. Combine with the next justified migration rather than prioritizing schema churn. Verify actual constraint definitions/delete semantics and fresh/upgrade behavior; retain the composite ownership FK and its required `runs_id_owner` unique index. Use a new forward migration; never rewrite committed migration history. Reverting this cleanup adds constraints after validation.

### Claim UI state

`src/features/gameplay/components/game/leaderboard-claim.tsx:33` separates status/reason/display data across state variables and refs; `:120` has deeply nested message selection. A local discriminated union and a simple message switch could clarify valid combinations. Proceed only if the resulting component is easier to read. Preserve exact pending request bodies/action IDs, duplicate-submit guard, unmount handling and prior eligibility. Existing claim tests provide the acceptance criteria. Do not introduce a reusable async-form framework.

### SQL rank qualification

Fetching/projecting TOP 1000 for every valid eligibility/claim is bounded and simple, but potentially wasteful. Measure query count, bytes and claim lock duration first. If material, compare a bounded count of outranking claimed runs against the current implementation. Preserve ore DESC/chests DESC/time ASC/UUID ASC, cohort isolation and atomic cutoff locking; differential tests should cover ties and ranks 999/1000/1001. If SQL duplicates ordering policy and costs more maintenance than it saves, retain the existing approach. No new database index is justified without query-plan evidence.

## Required guarantees and current compatibility boundaries

Retain security, authoritative scoring and gameplay fairness throughout the work. Other mechanisms below implement the current contract and may be replaced only through an explicit contract change described in the final section. Existing implementations and module arrangements are open to readability improvements.

- Server authority, owner/session checks, Origin protection, bounded inputs, safe DTOs and runtime response validation.
- Atomic versioned state changes, retry safety and one-claim constraints. Current exact historical-response replay is a compatibility requirement, not the only possible implementation of retry safety; replacing it requires the coordinated protocol decision below.
- Confirmed versus predicted state and reliable recovery for the chosen transport. Current session/channel/queue/transport responsibilities are justified while WebSockets/prediction remain; they need not survive a separately approved transport change unchanged.
- Existing saved rulesets and RNG behavior while affected runs remain supported. Retire cohorts only under an explicit lifecycle policy; do not replace simple compatibility branches with a plugin registry.
- Bounded solver search, legal construction witnesses and unknown-optimum semantics. Generator retries/fallbacks address approved gameplay requirements; reducing them changes balance and needs separate measured approval.
- Server-derived immutable final scores, atomic qualification and effective shared request protection. JSONB-derived projections and frozen signed pagination are current mechanisms, not untouchable product requirements; compact results/live pages need explicit schema/API changes. Process-local budgets do not replace shared protection across serverless instances.
- The short gameplay navigation event adapter, feature boundaries and AST-based checks. Replacing them with a global state system or new lint infrastructure has no demonstrated benefit.
- Native Vercel Git autodeploy, PostgreSQL-backed CI and serialized migrations. Do not add a separate deployment pipeline or remove migration locking. Build-time migrations must stay compatible with the deployed app.
- Four-language dictionaries and existing accessibility/keyboard/touch behavior. Audio implementation is pending; no speculative audio architecture is needed. Asset licensing remains a separate unresolved audit.

## Verification and delivery

Baseline review checks: `pnpm test` passed **431 tests**; **41 PostgreSQL tests skipped** because `TEST_DATABASE_URL` was unset. `pnpm lint` passed naming/architecture/Biome checks with the existing cursor `!important` warning. No build was run for this documentation-only review. No live database, deployment, browser checks or query benchmarks were performed.

For each implementation PR, run focused existing regressions plus `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build`. Read installed Next.js documentation before framework-specific edits. Database/protocol changes additionally require disposable PostgreSQL integration evidence for unauthorized/malformed requests, duplicates, concurrency, conflict recovery, refresh and rollback as applicable. UI changes need desktop/mobile keyboard and visual checks; do not add tests that merely mirror deleted wrappers.

PR acceptance should state what was removed, which behavior remains identical, any deliberately changed contract, concrete verification and unverified environment behavior. Stop a proposed cleanup if it introduces more configuration/abstraction than it removes. Use the listed full checks for application refactors; documentation-only changes need document/link checks, not a production build. Application-only behavior-preserving changes generally roll back by source revert. Persistence/protocol changes need an explicit compatibility and rollback plan; once history is deleted, a source revert cannot restore it. Never silently rewrite saved rules or historical evidence. Data compaction/deletion needs its own approved migration/retention scope; do not rewrite committed migration history.

## Additional scope: keep features and storage proportionate to a small fan game

**User direction.** Review whether features deserve to exist, rather than only cleaning their implementation. This is a small, noncommercial browser puzzle, not a competitive gaming platform or research project. Benchmark infrastructure, comprehensive historical records and sophisticated browsing guarantees must justify their code, storage and maintenance costs. The user reports approximately **32 MB for 16 runs** and considers this excessive. Prioritize a small operational footprint and understandable code over retaining every capability already built.

This section extends the earlier plan. Where earlier sections say to retain exact historical replies, frozen pagination or existing tooling, that describes compatibility under the **current contract**. The proposals below explicitly reconsider those contracts and features. They are recommendations for a later scoped implementation, not changes already approved or implemented. No benchmark, record, run or database object is removed by this document.

### Recommended cuts and reductions

| Area | Recommendation | Keep | Tradeoff / decision |
| --- | --- | --- | --- |
| Standalone Preview benchmarks | Remove the fixture generator, remote benchmark handler/client and their dedicated tests/configuration | Ordinary application CI and targeted regression tests | Lose dedicated deployed engine/database timing experiments |
| Large benchmark/report pipeline | Remove routine cohort surveys, progression comparisons, resource simulations and bulky report artifacts from the maintained application; preserve useful historical evidence in Git history or an archive outside the normal workflow | A small seeded correctness sample for generation and a manual timing check only when investigating a real problem | Future balance experiments may require a temporary script rather than permanent infrastructure |
| Full response stored per move | Stop retaining a complete historical run DTO for every move; first evaluate version-check plus resynchronization, then bounded compact receipts only if needed | Current authoritative state, version checks, retry safety and aggregate counters | Changes historical response replay semantics and requires coordinated client/server recovery changes |
| Old inactive runs and action receipts | Introduce explicit expiry and reclamation, including abandoned active runs whose owners have expired | Live resumable games, a defined reconnect grace period and minimal durable claimed results | End indefinite recovery of forgotten games; exact deadlines need a product decision |
| Finished-run payloads | Retain a compact final result instead of the entire last puzzle and its action responses indefinitely | Server-derived score, chests, finish time, cohort, claim identity and any statistics still displayed | Requires changing current JSONB-derived ranking projections, immutable-row rules and terminal-read/replay contracts |
| Frozen leaderboard pagination | Prefer ordinary bounded live pages; remove per-traversal stored TOP 1000 copies, cursor keys and signing if stable historical page traversal is unnecessary | Deterministic ordering, TOP 1000 cap, atomic claim qualification and bounded page sizes | New claims may shift rows between pages; browsing is no longer a frozen snapshot |
| Statistics and solver metadata | Keep only counters used by scoring or visible UI; stop persisting unused verified-optimum metadata if no product feature consumes it | Invalid-move penalties, pick damage and any retained end-of-run totals | Simplifies diagnostics; solver correctness and solvability checks remain necessary |
| Development-only screens | Consider removing the debug route and local run/reward simulator; retain focused tests instead | Public gameplay and help | Less interactive diagnosis; a temporary developer tool can be recreated when needed |
| Old cohort handlers | Stop adding permanent compatibility complexity by default; define retirement after affected active runs expire | Existing promised recovery until an explicit cutoff; immutable historical rankings stay in their own cohort | Existing runs must not silently change rules; compact historical results may outlive generator implementations |

The strongest code-based storage concern is repeated per-move snapshots, but its share of the reported size is unverified. Follow the reviewed execution order above: small diagnosis, tooling removal, then the minimum justified persistence change. The earlier debug continuation cleanup should be skipped if the entire debug feature is retired.

### What is actually stored for each move

`src/server/game/move-batch.ts` and `src/server/game/service.ts` insert a `run_actions` record for each accepted action. `response` contains the original public response, including a complete `RunDto`: plate positions, movement rules, resources and other public state. `src/server/game/persistence.ts` returns that stored reply on an exact retry. Socket batching updates the current run once, but still creates one full replay response per accepted move.

This is **not merely a measurement log**. The table currently provides idempotency and unknown-commit recovery. Conversely, those guarantees do **not inherently require an unlimited history of full puzzle snapshots**. The current design repeats largely unchanged data for every move. Aggregate move/invalid-move/broken-pick counters already exist in the current game document; those statistics do not require retaining every intermediate response. Solver paths are not persisted, so deleting solution histories would not address this storage pattern.

Current cleanup is especially conservative: all action records survive while the owning session is live; claimed runs and their action records remain protected; active runs survive even after their owner expires. Maintenance is manual. Consequently, finishing a game or letting a session expire does not reliably reclaim its history. This makes storage lifecycle a primary design issue, beyond making the delete loop faster.

### Proposed minimum persistence model

1. **Active game:** one current authoritative run document, version, owner and the initial lock needed for manual reset. Keep only live gameplay state, pending rewards and aggregate counters. Do not append historical puzzle snapshots. The initial lock is required for reset and is not an unnecessary copy during play.
2. **Move recovery:** evaluate removing per-move history entirely first. An original move with an old expected version can be rejected and the client can load current authoritative state rather than obtain its historical reply. `src/client/game/channel.ts` already has a conflict resynchronization path that clears speculative inputs, but this does not establish that removing receipts works unchanged. Check pipelined socket bursts, batches containing both accepted moves and rejected commands, lost replies, multiple tabs and reconnects. The product tradeoff is that unsent/uncommitted speculative inputs may be discarded during recovery instead of replayed seamlessly. If this is unacceptable or unsafe, use bounded compact receipts containing action identity/fingerprint, committed version and outcome. Do not start by building both designs.
3. **Old or delayed requests:** keep original expected versions on retries and never apply stale intents against a newly substituted version. Define how action-ID reuse is handled under the revised contract, including cross-run reuse. If receipts are retained, define behavior after expiry: reject or resynchronize rather than assume a request is new. Persistent sequence watermarks are not a default addition; introduce one only if the chosen model demonstrably needs it and is still simpler than current storage. Recovery must work after function restarts without a process-local cache.
4. **Lifecycle actions:** distinguish moves from create/continue/abandon/claim. Retain the minimal durable identity/receipt needed to prevent a duplicate run, duplicate reward or second nickname claim. A move-history expiry rule must not accidentally expire these protections. Prefer a small clear design over a general event log or event-sourcing system.
5. **Finished game, later if worthwhile:** retain an immutable compact final result for claimed runs: run ID, server-derived score, opened chests, finish time, ruleset/cohort, claim/name and any explicitly retained summary metrics. First remove or bound move-response duplication; one retained terminal puzzle may then be cheap enough to leave alone. Compacting it changes generated ranking columns, immutable-row triggers, owner/FK relationships and terminal DTOs, so it is a separate schema redesign with a higher cost than deleting telemetry. Measure its remaining contribution before doing it.
6. **Unclaimed results and forgotten games:** use a stated claim/recovery grace period, then remove unneeded puzzle payloads, receipts and eventually owner rows. Include expired-owner active games in a safe expiry policy. Preserve durable one-claim identity for displaced leaderboard entries. Use the smallest maintenance mechanism available in the existing stack, with bounded work and an explicit invocation schedule; do not add a queue service or analytics platform.

The recovery experience, inactive-run expiry and claim grace period are **open decisions**. A receipt window/count bound is needed only if that design is chosen. Select them from the intended player experience: normal refresh/reconnect works, a lost connection does not duplicate rewards, and forgotten runs do not retain unlimited data. Existing exact-reply tests and current retention contracts must be revised deliberately rather than bypassed. Prove one chosen design with the existing recovery tests and a few targeted failure cases; do not build a protocol framework or permanent experimental harness.

### Verify the reported 32 MB with a small storage check

The report is an actionable reason to investigate, but it is not yet a measured attribution to 16 game documents. Confirm what the displayed number represents: database storage, a provider storage metric or compute memory. These are different quantities. Do not label it RAM usage or claim an exact per-run cost without checking.

Use one read-only size breakdown against an explicitly selected development database when implementation is undertaken: current run documents, action response payloads, action counts per run, leaderboard snapshots, indexes and total table storage including out-of-line large values. Compare with an empty migrated baseline to separate game data from fixed overhead. Inspect average and largest response/document sizes. No new telemetry service, extension, permanent dashboard or benchmark suite is needed for this diagnosis. No database connection or size query was performed for this plan update.

**Storage acceptance.** A representative short and long run should show storage growing mainly with current/final state and any bounded retry window, rather than total lifetime moves multiplied by full snapshot size. If receipts remain, their cleanup must also cover claimed runs safely. Report before/after bytes and remaining overhead without promising an unsupported savings percentage. A shorter history must still pass duplicate/reconnect/out-of-order/rollback tests, including a delayed request after cleanup. Establish a simple storage budget from these measurements and check it manually after the redesign. Removing tiny numeric metadata such as `optimalMoves` is not a meaningful fix for megabytes of duplicated snapshots; treat that only as optional feature cleanup. Deleting report files from the current tree also does not shrink existing Git history or database storage.

### Keep validation small; remove the measurement product around it

The main removal candidates are `scripts/create-benchmark-preview.cjs`, `benchmark-preview-handler.cjs`, `benchmark-preview.cjs`, `benchmark-progression.cjs`, the broad survey/simulation/report workflow and associated report artifacts. `scripts/benchmark-locks.cjs` currently also supplies engine-loading and seeded utilities to other scripts/tests; migrate any retained correctness fixtures before deleting it. Remove dedicated benchmark tests when their feature disappears, while preserving gameplay and persistence regressions. Remove package commands and documentation that point to retired tooling. Historical reports may remain accessible through version control without being an actively maintained feature.

Keep a few deterministic generation cases proving legal solutions, inverse movement, bounds, fallback behavior and honest unknown optima. Keep authoritative scoring/reset/durability and ownership/concurrency/retry tests. Large comparative studies and permanent resource-sustain experiments need not be part of ordinary maintenance for this game. If slow generation becomes a real issue, use a focused temporary measurement. Changes to required validation procedures in `AGENTS.md` and game-engine/testing skills must accompany the tooling retirement; silently deleting scripts while leaving mandatory procedures behind would increase confusion.

### Other scope decisions and implementation order

- **Leaderboard browsing:** retain the approved TOP 1000 capacity initially, but reconsider frozen pagination as an unnecessary browsing guarantee. Simple live pages can eliminate the snapshot table and much cursor code. Explain shifting pages in the revised contract. An even smaller single TOP 100 list is a separate optional product cut, not an assumed change to qualification capacity.
- **Rate limits:** simplify around the remaining endpoints and existing hosting capabilities, but retain effective shared mutation protection. Do not replace durable budgets with in-memory limits on serverless instances. Removing snapshot creation may reduce the need for its specific budget; it does not eliminate abuse concerns for reads or claims.
- **Realtime transport:** reconsider whether both prediction/WebSockets and HTTP fallback earn their maintenance cost if the desired game can tolerate acknowledged moves over HTTP. This is a larger experience decision and currently changes the approved transport target. Try the interaction in a small prototype before proposing removal; prioritize storage and tooling cuts first.
- **Generation diagnostics:** remove unused production metadata and developer presentation before changing the actual generator. Retiring exact target tuning, BFS attempts or legacy cohorts can affect difficulty and ranked score comparability; it requires a separately scoped ruleset decision. Do not disguise a balance change as code cleanup.

Follow the single reviewed execution order near the start of this document. Feature removal and behavior-preserving refactoring are separate kinds of change: document product decisions before changing recovery, expiry, browsing or transport. Use additive/compatible migrations and separate, reviewable cleanup steps. Existing sessions, saved games and old clients need a transition strategy before destructive cleanup; no live deletion is authorized by this plan. Stop when the game has a modest measured storage footprint and the remaining flows are easy to maintain; completing every optional idea is not a goal.

## Reduce and make the test suite readable

**Owner requirement.** The current volume and readability of tests are part of the maintenance problem, not automatically a virtue to preserve. Review them alongside the reduced product. The baseline of 431 passing cases does not mean 431 independent behaviors are necessary: parameterized input cases contribute to that count, so inspect the tests rather than treating the number as a quality or deletion target.

**Remove or consolidate:**

- Tests for deleted benchmark, report, diagnostic and debug features. Remove their fixtures, mocks and helper infrastructure when unused.
- Tests that only verify trivial forwarding, private method calls or intermediate implementation shape, unless that detail protects a specific observable contract.
- Multiple tests of the same rule at several layers when one clear test plus a focused integration case provides equivalent confidence. Keep complementary coverage where failures differ; do not mechanically keep one test per function or delete every overlap.
- Historical-cohort tests once their corresponding code and support promise are explicitly retired. Keep coverage while those runs remain supported.
- Long scripted mock-response sequences when a direct domain test or a small integration scenario explains the same player behavior more clearly. Keep transport failure simulation where it proves something a happy-path integration cannot.
- Coverage-report generation in ordinary CI if no concrete use remains. Retain coverage as an optional diagnostic only if useful; do not add percentage gates or tests written just to raise the number.

**Keep a compact set of meaningful behaviors:**

| Concern | What the tests should explain |
| --- | --- |
| Puzzle mechanics | Legal slides and inverse effects, invalid moves leave positions unchanged, solvable generation and honest solver-budget outcomes |
| Durability and rewards | Four mistakes break a pick; reset/continue preserve damage and penalties; rewards are calculated and credited correctly |
| Player flow | Start, play, open, continue and game over; input/dialog behavior and refresh/recovery for the chosen transport |
| Score integrity | Ownership/input validation, no client-submitted score, no duplicate reward under retry/concurrency and no partial state on failed commit |
| Leaderboard | Server-derived ordering, qualifying nickname claim, cutoff/ties and one claim per run |

Use short setup, descriptive scenario names, explicit actions and readable assertions about outcomes. Use small domain fixtures and table-driven cases where they make rules easier to scan. For database guarantees, retain a small number of real PostgreSQL integration scenarios rather than replacing transaction evidence with extensive mocks. For UI behavior, prefer what a player sees or does over component internals. Do not replace the suite with a new testing framework or one enormous end-to-end test.

**Acceptance.** The remaining tests can be read as a concise description of the actual game. Tests tied only to removed features disappear; fixtures and test-only dependencies are removed when no longer used. Changed functions do not require widespread rewrites of private-call assertions. Important gameplay and score-integrity regressions remain covered, and gaps are reported honestly. Review the resulting suite size, fixture complexity and runtime, with no arbitrary target number or coverage percentage. Align test/CI instructions with the reduced suite so agents do not recreate unwanted benchmark or implementation-mirroring tests.


## Approved implementation — 2026-11-09

The owner approved the agreed functionality cuts and explicitly excluded frontend component edits. That authorization supersedes this document's earlier plan-only wording for the implemented scope below. Historical findings and alternative proposals above are not claims of current behavior.

Implemented: retirement of benchmark/Preview/survey/simulation/report infrastructure and dedicated tests; ordinary CI tests instead of routine coverage; unused dependency removal; live bounded ranking pages without snapshot creation/signatures; one public read budget; no new move/reset replay records, with original-version conflict/resynchronization; omission of optimum metadata from newly generated server locks; shared request/error handling; direct session/validation imports; bounded bulk retention deletion; concise current status with archived evidence.

Frontend components, debug UI and its local simulator are untouched. Historical cohort handlers, legacy move receipts, lifecycle/claim receipts, terminal game JSONB and dormant snapshot schema remain for compatibility. No new expiry deadline, scheduler, production migration, live cleanup or deployment is authorized or performed by this implementation. Compact terminal results and explicit run/claim expiry remain separate policy/migration work. No live storage attribution or percentage savings is claimed.

Rollback: source revert needs no SQL migration, but moves accepted after this change have no historical reply to recover. Older readers can encounter a version conflict and resynchronize. Legacy signed leaderboard cursors restart on INVALID_CURSOR; numeric cursors from this implementation likewise restart if served by old snapshot code. Existing rows and committed migration history remain unchanged. Test evidence is recorded after final verification below.


### Final local verification

- Full `pnpm test` with `TEST_DATABASE_URL` pointing only to disposable local PostgreSQL 17: **476 tests passed in 45 files**, including all database suites (no skips).
- Follow-up PostgreSQL suite after strengthening multi-run bulk deletion: **25 tests passed**.
- `pnpm lint`: passed naming, architecture and Biome checks; one pre-existing cursor `!important` warning remains.
- `pnpm typecheck`: passed after regenerating corrupt ignored development type output.
- `pnpm build`: passed outside the sandbox. The restricted Turbopack attempt stalled and was stopped; neither command applies migrations.
- `git diff --check` and Markdown local-file link checks passed. No changes under `src/features`, `src/components`, localized app pages or dictionaries.

No browser/device visual run, selected Neon storage measurement, live data deletion, production migration, deployment or GitHub issue changes were performed. No database-schema migration is needed for this source-only transition. Historical snapshot storage and replay rows are deliberately untouched.


## Approved compact storage implementation — 2026-11-09

The owner subsequently approved compact claimed results, aggregate global counters and temporary gameplay persistence with expiry. This supersedes earlier deferrals of those changes in this document. Frontend components remain untouched.

Migration 0004 copies authoritative result fields into immutable leaderboard entries and removes their dependency on run/session payloads. One bigint aggregate row is initialized from retained finished/abandoned games; a terminal transition trigger updates it once atomically. Already-deleted historical games remain unknown. No per-move statistics writes or public stats UI/API are introduced.

The existing fixed 30-day session remains the recovery/claim window. Authenticated daily bounded maintenance removes expired-owner full games/receipts after a 24-hour recent-write grace, including forgotten active and claimed runs; compact results and counters survive. It also prunes old move/reset receipts and expired snapshots/budgets. CRON_SECRET is server-only and must be configured after compact readers deploy. No live data deletion/migration/deployment was performed here.

After cleanup, a source-only rollback to join-based ranking is unsafe for visibility: compact rows survive, but old readers omit results whose source run is gone. Keep the compact reader on rollback or restore source data from backup. No committed historical migration was edited.


### Compact-storage verification

- Full `pnpm test` on disposable local PostgreSQL 17: **486 tests passed in 47 files**, no skipped database suites.
- Includes legacy claim/global-total backfill, migration runner concurrency/rerun/rollback, authoritative compact-field validation, terminal retry/rollback counting, ranking after source deletion, expired-owner cleanup, recent-write/lifecycle protection, old-history pruning and maintenance authentication.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` passed. One existing cursor `!important` lint warning remains. Schema generation reported no drift.
- Local Markdown-file link checks and `git diff --check` passed. No frontend components, dictionaries or localized app pages changed. The disposable database container was removed after testing.
- No production/development Neon migration, live cleanup, secret change, deployment or browser/device verification was performed. Applying migration 0004 and configuring deployed maintenance remain environment setup steps.


## Final correction: four tables — 2026-11-09

The owner's subsequent instruction supersedes the intermediate seven-table design and earlier completion claims. `0005_minimal-storage` leaves sessions, runs, leaderboard_entries and global_game_stats only. It removes full response records and frozen snapshots; shared rate limits move into existing session/global fields. Creation stores only accepted action/run IDs; accepted claims store action/rank. Other actions use original-version conflict recovery.

Terminal writes immediately clear the puzzle and retain a 24-hour result. Active games expire after seven days without accepted action. Sessions keep create identities through their fixed 30-day lifetime. Daily cleanup deletes expired payloads; compact claims and global totals survive. Migration transfers legacy required identities/counters, compacts old terminal rows, preserves stats without recount and drops the three old tables. Old temporary rows can expire immediately based on their last update.

A migration-runner preflight prevents unattended existing-database cutover. Prepare backup/new release, stop old code, then explicitly run STORAGE_CUTOVER=1 pnpm db:migrate during the switch. Fresh databases and subsequent post-cutover migrations use the normal command. No live migration, secret change, cleanup or deployment was performed here. Frontend components remain unchanged; refreshed terminal views have a summary and empty board.


### Final four-table verification

- Full pnpm test against disposable PostgreSQL 17: **473 tests passed in 47 files**, including all database suites. The main gameplay suite now explains the retained model directly instead of testing retired response logs.
- A real socket burst commits in order; stale retries conflict without response history. PostgreSQL cases cover owner/Origin/input isolation, create identity after expiry/deletion, damage/reset/continuation fairness, immediate terminal puzzle removal, one claim, atomic totals/rollback and cleanup.
- The migration runner suite confirms normal builds refuse existing-database cutover, then verifies explicit 0005 preserves claims, accepted IDs, quota windows and totals, leaves exactly four application tables, and reruns without recount. Its four tests passed again after strengthening upgrade assertions.
- pnpm lint, pnpm typecheck and pnpm build passed. Lint has one pre-existing cursor !important warning. Schema generation reports no drift; Markdown-file links and git diff --check passed.
- No frontend components/dictionaries/localized app pages changed. No live migration, cleanup, environment change, deployment or browser/device run was performed. Final board recovery from a saved terminal puzzle is intentionally removed.
