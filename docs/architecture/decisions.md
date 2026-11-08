# Product and architecture decisions

This is the **decision ledger**. Do not upgrade a proposal into an invariant without an explicit product decision and updated tests.

## Lock component terminology — 2026-11-06 (#60)

Use **plate** for the horizontally sliding element and **pin** for the stationary indicator. Align the middle of seven holes with each fixed pin; connected plates may slide together or in opposite directions. The [four-language glossary and technical compatibility rules](gameplay.md#lock-component-terminology-60) govern help, controls, accessibility, debug UI and documentation. Existing engine identifiers, translation keys, component filenames, wire fields and persisted state retain their names. This corrects terminology without changing mechanics, visuals, difficulty, rewards or `deterministic-ore-v1`; no migration or deployment is implied.

## Decided target (accepted)

| Decision | Meaning | Related issues |
| --- | --- | --- |
| Next.js + Vercel | One project, Route Handlers and Vercel-native WebSockets; no dedicated Docker backend | #27–#30 |
| Neon + Drizzle | PostgreSQL for anonymous sessions, authoritative runs and claimed ranking entries | #30–#32 |
| Server authority | Browser sends actions only; server computes transitions and score | #35–#42 |
| No client save | Remove gameplay `localStorage`; restore from server session | #40, #41 |
| Anonymous gameplay | Opaque HttpOnly session cookie; no login or nickname before play | #33, #34 |
| Arcade name entry | Ask nickname only when a finished server-verified run qualifies for TOP 1000; no permanent public player profile required | #24, #34, #46 |
| Run-based leaderboard | Rank claimed finished runs; multiple runs may share nickname or anonymous owner | #24, #25 |
| Endless primary mode | Random solvable puzzles, escalating difficulty; ore-based survival ranking, no bounded ranked mode for v1 | #48, #51 |
| Game resources | Ore nuggets and lockpicks only; ore is rank score | #24, #47 |
| Four invalid moves (#61) | New picks break on exactly four out-of-bounds attempts | #36, #37 |
| Reset fairness | Reset cannot refund spent picks or erase damage/penalties | #37, #49 |
| Deterministic ore (approved and implemented) | deterministic-ore-v1 formula below; chest progression and cumulative invalid moves determine ore | #47, #49 |
| Audio opt-in | Independent music/SFX toggles and volume; no surprise autoplay | #53, #54 |
| Third-party asset rights | Obtain and document sufficient rights before distribution | #52 |

## Open (do not hardcode)

1. **Further reward tuning:** the deterministic ore formula below is approved for `deterministic-ore-v1`; excess-valid-move penalties and future recalibration remain open.
2. **Lockpick replenishment:** predictable grant schedule vs another deterministic mechanic; total sustain/balance is unresolved.
3. **Competitive scoring order (resolved 2026-11-03):** endless ore ranking is approved; see the #51 decision below. A bounded challenge or efficiency ranking would be a separate future product decision.
4. **Difficulty tiers:** precise chest thresholds, optional milestone chests, minimum shortest-path length and acceptance criteria require calibration (#48, #50).
5. **Solver optimum (resolved technically under #50):** explicit search outcomes, replayed shortest paths, and null optimum for construction-only fallbacks are implemented. No optimum-based penalty is approved; difficulty recalibration remains #48.
6. **Run limits/anti-bot:** rate limit thresholds and possible fairness controls require measurement (#43, #51).
7. **Media assets:** approval of specific Gothic Remake music/SFX/art or replacements (#52–#54).

## Change procedure

- Record a proposed change, relevant options, tradeoffs and tests in an issue/PR.
- Make the product decision explicitly before changing a rule marked *decided*.
- Update this ledger, `AGENTS.md` (only if core rules change), gameplay docs, tests and UI copy together.
- For changed ranking/rewards, decide whether scores require a `rulesetVersion` split to avoid mixing incomparable runs.

## Arcade TOP 1000 qualification (accepted)

- Under 1000 claimed entries: every valid server-finished run may claim a place. At 1000 entries: a run must outrank the current last entry under deterministic ordering.
- Game Over eligibility is a snapshot, not a reservation. On nickname submission the backend must recheck atomically; racing submissions may displace a provisional qualifier.
- No unclaimed run appears in public results. Duplicate submissions for a run are prevented. Names do not establish identity or uniqueness.
- Safe deletion/expiry of old, unqualified run records is allowed after preserving active sessions, claims and required replay windows. Exact TTL remains an implementation decision.

## Approved implementation decision — 2026-11-01

The task author approved deterministic ore: `base = 10 + 5 * (chestNumber - 1)`, `ore = floor(base * max(0.4, 1 - 0.1 * invalidMovesOnChest))`. Implementation uses integer tenths to avoid floating-point floor errors. Ruleset: `deterministic-ore-v1`. All invalid moves survive resets and pick breaks; no excess-valid-move penalty is applied. Lockpick reward probabilities remain the existing behavior pending a separate balancing decision. This approval supersedes open item 1 for this ruleset. The later #51 decision below settles leaderboard ordering; release balance remains open.

## Approved transport direction — 2026-11-01

The task author explicitly requested WebSockets after testing the blocking per-move HTTPS UI. Use Vercel-native WebSockets for gameplay, ordered input buffering and immediate visual prediction with authoritative reconciliation. The server remains responsible for every committed action, resource, reward and final result. Public movement mechanics may be sent to the owner to predict visuals; internal solver paths/seeds remain private. No separate WebSocket hosting service is required by the chosen implementation.

## Approved competitive scoring decision — 2026-11-03 (#51)

The task author selected endless ore ranking. Keep endless as the primary mode; v1 has no bounded ranked challenge, duration cap, or excess-valid-move/optimum penalty. Rank each claimed, server-finished run by **credited ore DESC, opened chests DESC, finished_at ASC, run UUID ASC**. Finish time compares instants, not timestamp strings; UUIDs use PostgreSQL UUID order (canonical lowercase in TypeScript). Names and owner IDs never break ties or deduplicate entries. Zero-ore finished runs qualify while space exists. Abandoned and active runs never qualify.

The pure policy is implemented in `src/server/leaderboard/policy.ts`: it projects a persisted final result, compares ranks and evaluates a snapshot of claimed runs. The policy is not an endpoint or an atomic claim service. Snapshot eligibility reserves nothing. Retain displaced claims (query only TOP 1000) so one run cannot reclaim; claim uniqueness and cutoff recheck must share a database transaction under #24/#46. Compare only the same ruleset. The active cohort remains `deterministic-ore-v1`, since this decision changes no gameplay rewards. Any future change to ore, replenishment, difficulty or run limits that affects score comparability requires a new ruleset and separate ranking cohort, rather than silently mixing historic scores.

Retain current random pick replenishment for this cohort; a deterministic replacement and calibration remain open. This ranking measures endless survival and ore accumulation, not equal-puzzle efficiency or freedom from luck. See [competitive ranking](competitive-ranking.md) for sustain analysis, release risks and linked implementation contracts.

## Reward implementation completion — 2026-11-05 (#47)

The earlier deterministic-ore-v1 and #51 approvals govern the older #47 proposal: keep the integer ore curve and 40% floor, apply no excess-valid-move penalty, and retain random pick replenishment. This implementation centralizes tuning, documents the calculation at `getDeterministicOre()` and records a seeded resource simulation in [gameplay](gameplay.md#reward-transparency-and-balance-evidence-47--2026-11-05). The approved reward parameters remain unchanged. Random sustain and player/difficulty calibration remain open release work; deterministic ore alone does not make endless runs finite.

The task author subsequently requested the original reward UI with no calculation details. The breakdown UI requirement from #47 is superseded; keep reward items and total ore only, with rules explained in the calculation function’s code comment.

## Approved capacity, pagination and modal flow — 2026-11-05

The task author expanded arcade qualification from TOP 100 to **TOP 1000 claimed finished runs** and requested paginated browsing. The existing run-based identity remains: nicknames are nonunique labels, multiple runs by one anonymous owner may rank, and this does not deduplicate people. Below 1000 claims every valid finished run may submit; at capacity a candidate must outrank the current 1000th. Eligibility remains provisional and is rechecked atomically on submission. Displaced claims remain durable.

The public read contract retains frozen cursor pagination, 25 entries per page by default and a maximum request size of 100; the entire traversal is bounded to 1000 entries. Qualification is independent of page size. The task author explicitly scoped this change to contract, qualification and modals; public read endpoints, snapshot storage and ranking page remain future #24/#46 work. No GitHub issue mutation is implied.

Game Over shows statistics first. Continue closes that modal and opens a separate leaderboard modal; eligibility is fetched there, with nickname entry only for qualifiers and a new-run action for every outcome. This supersedes #34's original inline form. All four languages retain error/retry/expired-session states.

The shared `LEADERBOARD_SIZE` constant in `src/api/contracts.ts` drives policy, bounded SQL reads and client response validation. This expands publication capacity without changing gameplay rewards, ordering or stored results, so `deterministic-ore-v1` stays unchanged. No migration/backfill is required. Historical action replies are replayed unchanged, including old ranks or rejected qualification snapshots; a fresh eligibility read/new claim action uses the new cutoff. Rollback restores the old capacity/UI but retains all durable claims and results, including claims outside the reduced cutoff.


## Solver validation and measured fallback — 2026-11-05 (#50)

Retain the current deterministic-ore-v1 generator selection, 12 attempts and 20,000-state search cap. Explicit outcomes distinguish proof of unsolvability from budget exhaustion, and all returned solution witnesses are replayed. Offline diagnostics measure target shortfalls without promising a minimum. A 12,000-lock seeded survey shows late targets are frequently missed (92.7% at chest 1,000; 99.1% at chest 10,000). The existing bounded fallback is retained for compatibility, rather than silently changing this cohort's difficulty. This is measured technical behavior, not approval of a new difficulty curve or a claim of human calibration. Any stricter rejection/target change remains an explicit #48 decision and requires ranking-cohort review.

Construction-only witness lengths are upper bounds, never verified optima. No extra-valid-move penalty is introduced, including when optimal metadata is available. See [validation, distributions and Preview thresholds](lock-validation.md) for evidence and rollback. No migration, production deployment or GitHub issue mutation is part of this work.

## Approved progression and durability — 2026-11-06 (#61)

This decision changes the original 3–6-plate progression to 4–7 plates and increases durability from three to four invalid moves per pick.

| Difficulty stage | Previous chests / plates | Approved chests / plates |
| --- | --- | --- |
| 1 | 1–4 / 3 | 1–5 / 4 |
| 2 | 5–10 / 4 | 6–12 / 5 |
| 3 | 11–18 / 5 | 13–24 / 6 |
| 4 | 19+ / 6 | 25+ / 7 |

| Lockpick rule | Previous | Approved |
| --- | --- | --- |
| Invalid moves before breaking | 3 | 4 |
| Starting lockpicks | 3 | 3 (unchanged) |

The [2026-11-05 performance report](archive/2026-11-05-lock-benchmarks.md) and [difficulty survey](archive/2026-11-05-lock-validation.md) preserve measurements of the previous rules. The current [performance report](lock-benchmarks.md) and [difficulty/resource survey](lock-validation.md) measure the approved rules and compare them with those baselines. Raw results retain their measurement dates and source hashes.

The task author requested implementation of #61: 4 plates on chests 1–5, 5 on 6–12, 6 on 13–24 and 7 on 25+, with four invalid moves per pick. Existing dependency density, scramble/solution curves, seven positions, target 3, inverse moves, 12 attempts and 20,000-state solver cap remain unchanged. Reset and continuation carry partial damage and cumulative penalties. Ore calculation, random pick replenishment and ranking tie order remain unchanged.

The main ranking uses `deterministic-ore-v1`. This pre-release update requires no SQL schema migration or data rewrite. See [current performance](lock-benchmarks.md) and [difficulty/resource evidence](lock-validation.md).

Rollback before release is an application-code revert. Future changes after ranked results exist require a score-comparability review.


## Approved scarce lockpicks — 2026-11-07

The task author requested one starting lockpick and halved drop chances. New runs start with one pick and use 79%/17%/4% for 0/1/2 picks (previously 58%/34%/8%). Thus the chance of any pick drops from 42% to 21%, and expected replenishment from 0.5 to 0.25 picks/chest. Maximum drop remains two; stored inventory remains uncapped. UI, lock generation/progression, four-invalid-move durability, damage carry, reset penalties and deterministic ore are unchanged.

Because resource supply affects survival/ranked ore, new creation and main ranking use `scarce-picks-v1`. Existing `deterministic-ore-v1` runs retain their current inventory, old drop table and already-pending rewards; old results/claims/replays remain durable and separate. No schema migration, data rewrite or deployment is part of this change. A rollback must retain both reward handlers while active runs exist; restore the old starting stock/default cohort in application code rather than rewriting saved games.

Resource-only simulation: seed 47, 10,000 runs/profile, cap 1,000 credited chests, starts with one pick, carries partial damage, and ends before loot on the last pick's fourth invalid move. At fixed 0/1/2/3/6 mistakes per chest, median credited chests are 1,000 (all censored) / 7 / 1 / 1 / 0. The one-mistake profile has p95 551 chests and 3.77% censored survivors. These are resource scenarios, not human difficulty measurements or a finite-run guarantee. Reproduce with `node scripts/simulate-rewards.cjs`; historical #61 figures describe the older balance and are not overwritten.


## Approved learning ramp — 2026-11-08 (#48)

The task author requested implementation of the [new-player progression plan](new-player-progression-plan.md), keeping lockpicks unchanged. New `learning-ramp-v1` runs begin with four plates and one connected pair; same-direction coupling is used through chest 3. A bounded core/edge policy grows gradually through chest 100, with stable mature settings afterward. Path targets wait on connection-addition chests; total plate counts use overlapping probabilities. Additional isolated plates start aligned until their turn to join the core. Structural tiers derive from actual initial rules, not plate count or a cosmetic chest label: Tier 2 requires a three-plate core or two directional edges; Tier 3 requires core ≥4 and edges ≥6; Tier 4 requires core ≥5 and edges ≥10. This preserves the issue’s Tier 3 floor at chest 18 without unrestricted later Beginner rolls.

Lockpicks retain one starting pick, 79%/17%/4% drops, four-invalid-move durability, uncapped inventory and carried damage. Deterministic ore, reset penalties, bounds, inverse movement and server transaction semantics are unchanged. The generator keeps 12 attempts and the solver’s 20,000-state cap; legal witnesses ensure solvability and capped searches retain unknown optima. Requested length windows remain targets, not guarantees.

Generation affects survival and ranked score comparability, so the new cohort is separate even though resources are unchanged. Old `scarce-picks-v1` and `deterministic-ore-v1` runs retain their exact generators, labels, resource policies, pending rewards and historical replays. No SQL migration or data rewrite is required. Rollback switches defaults while retaining supported cohort handlers; it must not downgrade saved learning-ramp runs. No unpublished connections-v2/v3 code was available in this checkout or imported.

Measured calibration also samples exact path targets uniformly within the scheduled window before the connected core reaches seven plates. This removes the constructor’s bias toward the longest attainable path; the original 12-attempt/20,000-state limits and honest target shortfalls remain. Mature cores retain bounded windows to avoid forcing expensive exact late paths.

The [implementation report](learning-progression-report.md) records local tests and paired measurements. Human calibration, browser/device checks and deployed Preview acceptance remain pending; implementation and local benchmarks do not establish production readiness. No GitHub issue mutation or deployment is implied.


## Approved Vercel autodeploy and production checks — 2026-11-08

The task author selected native Vercel Git autodeploy with Deployment Checks. Vercel owns builds/deploys; GitHub CI reports `Quality Checks` on the exact commit, and Vercel waits for that check before assigning production domains. The check was saved remotely for Production; Production Branch `master` and automatic aliasing were verified. Preview retains native automatic publication. No separate Actions deployment workflow or Vercel token in GitHub is introduced.

The repository’s Vercel build command applies committed Drizzle migrations before Next.js build, with a session advisory lock on the same direct PostgreSQL connection used by Drizzle. Migration failure stops the build. CI uses ephemeral PostgreSQL 17 and runs real database tests. Normal local/CI `pnpm build` does not migrate. Deployment Checks do not delay build-time migrations; schema changes must remain compatible with the previously deployed application and are not automatically undone when CI/build/promotion fails. See [setup, concurrency and rollback](server-setup.md#autodeploy-and-required-production-checks).

Only the deployment-check setting was changed remotely. No production migration, deployment, push or environment-secret download was performed. Repository changes must reach the release commit before build-time migration automation takes effect; live blocked/successful promotion has not been exercised.


### Build command managed in Vercel — 2026-11-08

The task author subsequently chose to edit Build Command in the Vercel dashboard. Remove the repository’s `vercel.json` override so it cannot supersede that setting. The production `Quality Checks` gate, PostgreSQL-backed CI and serialized migration runner remain useful independently of where Build Command is configured. Use `pnpm db:migrate && pnpm build` for automatic migrations or `pnpm build` for build-only deployments. The task author confirmed `pnpm db:migrate && pnpm build` as the intended dashboard value, preserving automatic migrations. The actual dashboard edit is user-managed and was not changed or verified in this follow-up.


## Approved difficulty-based ore — 2026-11-08

The task author approved lowering early ore and awarding a fixed base for each existing difficulty tier: Tier 1 = 2, Tier 2 = 5, Tier 3 = 10, Tier 4 = 20. The existing cumulative invalid-move penalty stays: `floor(base * max(4, 10 - invalidMovesOnChest) / 10)`. Reset and pick breaks preserve mistakes; valid moves add no penalty. Final integer flooring is unchanged, including zero ore at Tier 1 after six mistakes. Difficulty is derived from authoritative initial connection rules, matching the public tier; chest number no longer increases ore within a tier.

New runs and the main leaderboard use `difficulty-ore-v1`. Generation and scarce-pick supply remain exactly those of `learning-ramp-v1`. Saved learning-ramp, scarce-picks and deterministic-ore cohorts retain their exact scoring, pending rewards, generators, resources, claims and historical replays. No SQL migration or data rewrite is required. Rollback changes the default cohort and retains the explicit new handler for saved difficulty-ore runs; never rewrite their rewards. This decision supersedes the chest-based ore requirement for new runs only. No GitHub issue mutation or deployment is part of this task.


## Approved full plate participation — 2026-11-08

The task author requested random connected plates from the entire visible lock, including the last positions, and mixing of independent plates. New `all-plates-v1` runs implement this: unbiased core membership, all rules eligible during mixing, and uniformly random independent positions including the target after shortening/fallback. Existing structural progression and tier-based ore, one starting pick, drops, damage and reset penalties remain unchanged. Final independent sampling may put path length outside the former target window; see gameplay.md for the algorithm and paired measurements.

This affects difficulty and score comparability. New runs and the main ranking use the separate all-plates cohort. All saved cohorts, including difficulty-ore-v1, retain their original generator and rewards on continuation. No SQL migration/data rewrite is needed. Rollback switches the default cohort while retaining the new handler for saved all-plates runs. No issue mutation, migration or deployment is authorized by this implementation.


The task author clarified that independent positions must include the center with equal probability, rather than always requiring alignment. The final draw now covers all seven positions uniformly. If every plate ends aligned, one legal core move ensures an unsolved chest without changing the independent draws. Construction witnesses stop at the first solved state to respect runtime solved guards.
