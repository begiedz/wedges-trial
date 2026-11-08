# Learning progression implementation — 2026-11-08 (#48)

Implemented locally as `learning-ramp-v1`, following the task author's request to implement the [progression plan](new-player-progression-plan.md) while keeping lockpicks unchanged. Human difficulty calibration and browser/Preview acceptance remain pending. No production deployment, migration, data rewrite, commit, PR or GitHub issue edit was performed.

## Behavior and scope

New runs start with four plates and one connected pair. Through chest 3, the pair slides in the same direction. Later connections may have opposite signs. A spanning chain guarantees the required connected core; bounded additional directional edges add complexity gradually. Each chest adds at most one edge. Fanout is capped at one through chest 5, two through chest 18 and three thereafter. Plates beyond the original four start aligned while independent, then join the core at later milestones. Eligible total plate counts overlap in probability rather than forcing the old jumps at 6/13/25.

The public tier comes from actual immutable initial movement rules. Count right-direction cross-plate effects, excluding self-effects and inverse duplicates; reciprocal dependencies count separately. Undirected components describe structural coupling, never recursive movement. Classification is:

| Tier | Structural requirement |
| --- | --- |
| 1 | Neither higher-tier condition is met; seven plates with one connected pair qualify |
| 2 | Core of at least three plates, or at least two directional dependencies |
| 3 | Core of at least four plates and at least six directional dependencies |
| 4 | Core of at least five plates and at least ten directional dependencies |

Higher-tier conditions take precedence. The generated tier is independent of layout and total plate count; it remains stable through moves, reset, refresh and replay. The policy yields Tier 1 on chests 1–4, Tier 2 on 5–17, Tier 3 on 18–29 and Tier 4 thereafter. These labels estimate difficulty; they do not prove equal human effort within a tier.

### Implemented anchors

| Displayed chest | Eligible plates | Required core | Directional edges | Requested shortest-path window |
| ---: | --- | ---: | ---: | --- |
| 1 | 4 | 2 | 1 | 2–4 |
| 3 | 4 | 2 | 1 | 3–4 |
| 5 | 4 | 3 | 2 | 3–4 |
| 8 | 4–5 | 3 | 3 | 3–5 |
| 12 | 4–6 | 4 | 4 | 4–6 |
| 15 | 4–6 | 4 | 5 | 5–7 |
| 18 | 4–6 | 4 | 6 | 5–7 |
| 24 | 5–7 | 5 | 8 | 6–8 |
| 30 | 5–7 | 5 | 10 | 7–9 |
| 50 | 6–7 | 6 | 14 | 8–11 |
| 100 | 7 | 7 | 18 | 9–15 |
| 101+ | 7 | 7 | 18 | 10–16 |

Integer edge additions are spread between anchors. Every connection addition holds the previous chest's path window; requested length increases follow on a later chest. This deliberately changes the proposal's windows at chests 5/8/12/18/24/30/50/100 rather than increasing connections and requested path length together. Mature structural settings stop growing at chest 100; the deferred final length window takes effect at 101. Individual actual solutions can be shorter or longer than neighboring locks; only the structural floor is nondecreasing. Length windows remain bounded-retry targets, not guarantees.

Before the core reaches seven plates, sample an exact target uniformly within the scheduled window. This counters the generator’s bias toward the longest attainable path. `solutionLengthRange` records that offline window; configured minimum/maximum lengths are the selected target. On mature seven-plate cores, retain the bounded window rather than forcing expensive exact late targets. A missed sampled target is distinct from falling below the scheduled window floor.

The generator retains 12 attempts and the solver's 20,000-state budget. Every returned lock has a legally replayed construction witness. Only independently verified optima are called shortest solutions; capped searches retain unknown metadata. Movement, bounds and inverse effects are unchanged.

Implementation entrypoints: `src/game/learning-progression.ts` owns the pure policy; `generate-rules.ts` builds constrained networks; `analyze-connections.ts` classifies actual rules; `create-lock.ts` dispatches by saved cohort. `src/server/game/engine.ts` derives the stable DTO tier and uses cohort-aware continuation inside the existing transaction boundary. No route or database infrastructure was added.

## Resources, persistence and rollout

Lockpicks retain one starting pick, four invalid moves before breaking, 79%/17%/4% drops of 0/1/2 picks, uncapped inventory and damage carried across resets/chests. There are no tier-based drops. Deterministic ore and accumulated penalties are unchanged. No new UI layout, resource, hint, scoring penalty or trusted client field was introduced. EN/PL/DE/RU About and debug copy now describes gradual progression rather than promising every chest is individually harder.

Difficulty affects survival and ranked ore, so new runs/main ranking use a new cohort. Saved `scarce-picks-v1` and `deterministic-ore-v1` runs retain the exact old generator, chest-based difficulty labels and original resource handlers. Pending rewards and exact action responses are never rerolled or rewritten. New tier computation uses existing `initialLock.rules`; generation configuration is neither persisted nor accepted from requests. No schema migration or backfill is needed.

The learning handler uses the fixed `LEARNING_RULESET_VERSION`, independent of the new-run default. Rollback changes defaults while retaining that handler for saved learning-ramp runs; a regression explicitly changes the default back to scarce-picks and verifies both dispatch paths. Existing claims/results stay durable and separate.

## Matched benchmark

The initial 53,000-lock candidate survey found median optimum increases of 6→8 at chest 18 and 8→10 at chest 30. The implementation was refined to hold length targets on every connection addition, not only core growth. Its complete initial [survey](../../benchmarks/results/archive/2026-11-08/learning-ramp-v1-survey.gz), [timings](../../benchmarks/results/archive/2026-11-08/learning-ramp-v1-timing.gz), [resources](../../benchmarks/results/archive/2026-11-08/learning-ramp-v1-resources.gz) and [manifest](../../benchmarks/results/archive/2026-11-08/learning-ramp-v1-manifest.json) are preserved. The held-target refinement then moved one median jump to 30→31 (8→10) and exposed latency outliers. That complete [survey](../../benchmarks/results/archive/2026-11-08/held-targets/learning-ramp-v1-survey.gz), [timing](../../benchmarks/results/archive/2026-11-08/held-targets/learning-ramp-v1-timing.gz), [resources](../../benchmarks/results/archive/2026-11-08/held-targets/learning-ramp-v1-resources.gz) and [manifest](../../benchmarks/results/archive/2026-11-08/held-targets/learning-ramp-v1-manifest.json) are also preserved. The final policy additionally samples exact early targets; final results below measure that policy, with the unchanged baseline retained.

Candidate source SHA256 over sorted `src/game/*.ts` names and bytes: `7be6bfab848f4cc894411052e69882258ebb50d4b7eaa78ee78b2e13222173e8`. The retained baseline uses `f956a264c16ad712d4b9e5267b68309c279db3dc1c350984a50041e5947568c8`; only the learning policy changed between those revisions, and the legacy generator path is identical. Candidate measurements use the emitted final engine, with no subsequent domain source edits. Baseline and candidate run sequentially in separate comparison phases under cached `node:22-bookworm-slim`, Linux arm64 on the same host, no network, one CPU and 2 GiB memory, without concurrent tests/builds. These are local CPU measurements, not Vercel, Neon or deployed throughput.

The paired survey measures 1,000 locks at every chest 1–50 and at 100/1,000/10,000: 53,000 per cohort, 106,000 total. Seed 50; input `50 + chest * 100003 + sample` is mixed by `mixSeed()` before the harness LCG. The raw actual seed is stored for every sample. Both cohorts use identical input seeds; new generation consumes an additional configuration draw intentionally. The mixer avoids adjacent seeds correlating initial plate-count draws. No survey warmups or outliers are removed.

Independent final solving and construction-witness replay are outside generation timing. Raw samples include actual configuration, plate counts, structural metrics, initial legal-action count, optima, shortfalls, cap counts, CPU and wall times. Baseline `structure.tier` is the new classifier's offline description, not its legacy public chest-based label.

A separate timing benchmark measures generation, independent solving and continuation at 13 early/boundary/late checkpoints, 100 samples each, seed 28, three discarded warmups. Continuation uses a legally solved predecessor and the matching generator. It measures the pure debug helper, not SQL/socket latency. Per-row timing `config` is illustrative because plate counts vary; the survey stores every actual sample configuration. RSS is the process high-water mark at survey/timing completion, including prior untimed validation and retained reports in that process. The refined candidate runs in a fresh process; RSS values are gate evidence, not an isolated memory-efficiency comparison.

### Results

Runtime: Node **v22.23.4**, Linux arm64; baseline survey completed 2026-11-08T07:57:17.551Z and candidate survey completed 2026-11-08T08:28:45.643Z (UTC). Base commit `ae885523174b189822c4c5c36b6733bff9a0ad15` plus the local implementation; the source hash identifies the measured engine. Emitted engine SHA256: `b4c06e3932e892ca94cd6b16ae4eb09c18f2329b4c53a582c4633ede8192c7f5`.

| Cohort | Worst generation/continuation p95 (ms) | Observed max (ms) | Cumulative RSS (MiB) | Existing local gates |
| --- | ---: | ---: | ---: | --- |
| Saved scarce-picks baseline | 114.90 | 380.00 | 269.18 | FAIL |
| New learning ramp | 117.91 | 5538.48 | 288.16 | FAIL |

Gates are p95 <100 ms, observed max <500 ms and process RSS <2 GiB. The baseline timing benchmark exceeds p95 at chest 10,000 even though its larger survey p95 is below 100 ms. **NO-GO on local latency acceptance:** the final candidate also fails p95 (117.91 ms) and maximum (5,538.48 ms). These measurements do not establish deployed latency or production readiness. The original, held-target and final complete runs are all retained; none was selected to hide a failed gate.

| Chest | New plate counts 4/5/6/7 (out of 1,000) | Core / edges / tier | Baseline median optimum | New optimum p50 / p95 | New generation p95 / max (ms) |
| ---: | --- | --- | ---: | --- | --- |
| 1 | 1000/0/0/0 | 2 / 1 / 1 | 4 | 3 / 4 | 1.24 / 60.06 |
| 3 | 1000/0/0/0 | 2 / 1 / 1 | 6 | 4 / 4 | 0.38 / 15.98 |
| 5 | 1000/0/0/0 | 3 / 2 / 2 | 6 | 4 / 4 | 0.41 / 16.35 |
| 6 | 750/250/0/0 | 3 / 2 / 2 | 8 | 4 / 5 | 0.68 / 2.13 |
| 8 | 512/488/0/0 | 3 / 3 / 2 | 8 | 4 / 5 | 0.79 / 8.37 |
| 12 | 354/335/311/0 | 4 / 4 / 2 | 10 | 5 / 6 | 2.54 / 44.43 |
| 13 | 337/330/333/0 | 4 / 4 / 2 | 10 | 6 / 7 | 4.63 / 268.71 |
| 15 | 329/333/338/0 | 4 / 5 / 2 | 10 | 6 / 7 | 3.34 / 46.50 |
| 18 | 331/351/318/0 | 4 / 6 / 3 | 12 | 6 / 7 | 3.33 / 32.17 |
| 24 | 0/345/340/315 | 5 / 8 / 3 | 12 | 7 / 8 | 16.92 / 100.54 |
| 25 | 0/315/349/336 | 5 / 8 / 3 | 12 | 8 / 9 | 45.09 / 653.09 |
| 30 | 0/332/342/326 | 5 / 10 / 4 | 13 | 8 / 9 | 18.74 / 100.87 |
| 50 | 0/0/511/489 | 6 / 14 / 4 | 14 | 9 / 11 | 48.75 / 147.84 |
| 100 | 0/0/0/1000 | 7 / 18 / 4 | 16 | 12 / 15 | 66.58 / 198.66 |
| 1000 | 0/0/0/1000 | 7 / 18 / 4 | 17 | 12 / 16 | 76.24 / 791.14 |
| 10000 | 0/0/0/1000 | 7 / 18 / 4 | 17 | 12 / 15 | 117.91 / 5538.48 |

Adjacent-chest median increases greater than one move: **none across chests 1–50**. Structural core/edge/fanout and exact tier-floor checks pass for every one of the 53,000 candidate samples.

Baseline: 53,000 legally replayed witnesses; 0 unknown independent final optima; 0 unverified generation fallbacks; 3677 below-target locks; 1209 capped internal candidate searches; 0 optimum mismatches.

Learning ramp: 53,000 legally replayed witnesses; 0 unknown independent final optima; 0 unverified generation fallbacks; 1775 below-target locks; 2193 capped internal candidate searches; 0 optimum mismatches.

Candidate misses below the scheduled window floor (rather than the sampled exact target): 86. Exact-target misses above are not directly comparable to the baseline’s window-floor misses. Lower requested windows, not a solver algorithm change, explain much of the reduction in late shortfalls.

### Latency investigation

The three slowest final survey seeds (all chest 10,000) were each regenerated 20 times in a fresh process under the same Node 22/one-CPU/2 GiB limits. Every replay matched its original movement-rule hash and verified optimum. Seeds `2271772898`, `3868094473` and `664628199` originally took 5,538.48 / 2,371.48 / 1,042.20 ms. Their 20-repeat maxima were 413.21 / 491.73 / 107.54 ms; the first two still had p95 above 100 ms. The multi-second observations were not reproduced or explained. No original outlier was discarded. Profiling under sustained load and deployed continuation measurements remain required before release. See [all 60 exact-seed observations](../../benchmarks/results/learning-ramp-v1-outliers.gz); replay each stored seed through `seededRandom`, `getLearningProgression(chest - 1, random)` and `createLockWithDiagnostics(config, random)`, timing configuration plus generation and checking `ruleHash`/`optimum` against the saved observation.

The final corpus has more capped internal candidate searches than the baseline (2,193 vs 1,209); this is a search-cost regression, even though every final optimum was verified and the scheduled-window floor was missed only 86 times. Do not interpret target attainment as a solver-speed improvement. Solver/retry budgets were not increased.

### Unchanged resource sustain

Seed 47, 10,000 runs/profile, a 1,000-credited-chest cap, actual reward functions, one starting pick and carried damage. Game over happens before loot on the final pick's fourth invalid action. Censored survivors are not finished ranking entries. These fixed-mistake scenarios measure the unchanged resource policy; they do not model learning or establish improved player survival. The raw file also retains the script's historical three-mistake sensitivity comparison.

| Mistakes per chest | Median / p95 credited chests | Censored at 1,000 |
| ---: | --- | ---: |
| 0 | 1000 / 1000 | 100.00% |
| 1 | 7 / 551 | 3.77% |
| 2 | 1 / 7 | 0.00% |
| 3 | 1 / 3 | 0.00% |
| 6 | 0 / 0 | 0.00% |

Raw evidence: [baseline survey](../../benchmarks/results/scarce-picks-v1-survey.gz), [baseline timings](../../benchmarks/results/scarce-picks-v1-timing.gz), [learning survey](../../benchmarks/results/learning-ramp-v1-survey.gz), [learning timings](../../benchmarks/results/learning-ramp-v1-timing.gz), [resources](../../benchmarks/results/learning-ramp-v1-resources.gz). [Manifest and checksums](../../benchmarks/results/learning-ramp-v1-manifest.json) identify every file; previous dated evidence is unchanged.

## Verification and remaining acceptance

| Criterion | Status | Evidence |
| --- | --- | --- |
| Gradual core/edge growth and nondecreasing actual tier floor | PASS | 30 seeded rule samples at every chest 1–151; exact budgets, fanout, inverse effects and Tier 3 at chest 18 |
| Sparse seven-plate locks remain Beginner | PASS | Dedicated topology fixture; classification excludes self/inverse counts |
| Construction solvability and honest unknown optima | PASS | Boundary/late legal replay tests, independent solver agreement and forced-budget-exhaustion fallback regression |
| Old generators remain compatible | PASS | Seeded byte-for-byte lock comparisons for both saved cohorts; PostgreSQL old-cohort continuation |
| Stable server-derived tier across reset/refresh/replay | PASS | Domain lifecycle test and PostgreSQL chest-18 regression |
| Reward once, concurrent continuation and carried partial damage | PASS | Real PostgreSQL transaction/replay test; existing rollback, ownership, stale-version and WebSocket regressions |
| Existing resource probabilities and deterministic ore retained | PASS | Reward boundary/distribution tests and equal new/saved scarce-pick solve rewards |
| Rollback preserves saved learning-ramp handler | PASS | Default-switch regression; fixed identifier dispatch |
| Four locales and original presentation retained | PASS | Updated existing dictionary keys; existing localized render suites; no component/layout changes |
| Neighboring median solution lengths through chest 50 | PASS | 53,000-lock final survey: no adjacent increase above one move |
| Local generation/continuation latency acceptance | FAIL | p95 117.91 ms; observed max 5,538.48 ms; exact-seed replay does not explain the multi-second tail; release profiling remains pending |
| Complete tests and coverage | PASS | `pnpm test` and `pnpm test:coverage`: 436 tests each, including all 38 real PostgreSQL tests against a disposable localhost container |
| Names, architecture, lint, TypeScript and production build | PASS | `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build --webpack`; existing cursor CSS `!important` warning remains |
| New-player understanding and perceived transition smoothness | NOT VERIFIED | Requires the proposed first-time-player sessions; no human outcomes inferred from graph/solver metrics |
| Browser/device and deployed Preview acceptance | NOT VERIFIED | No visual/device or deployed end-to-end checks performed |

The benchmark artifact smoke test has a bounded 30-second timeout because coverage instrumentation exceeds Vitest's five-second default; its resource fixture uses three runs while production evidence uses 10,000. An initial coverage run exposed that timeout; the corrected complete suite passes. Overall measured coverage is 70.37% statements/lines, 91.50% branches and 82.88% functions; no new coverage threshold is claimed.

Keep #48 open for latency investigation, human calibration and Preview acceptance. No tier-dependent replenishment from older issue proposals was adopted. Fixed-mistake resource simulations cannot establish improved player survival. Recruit first-time players as described in the plan and measure solve time, mistakes, resets, last reached chest and perceived difficulty before final balance sign-off.

## Reproduction

Native matched comparison (timings depend on the host):

```sh
node scripts/benchmark-progression.cjs /tmp/learning-ramp-evidence 1000
```

For the measured bounded environment, create an empty fixture directory with `node scripts/create-benchmark-preview.cjs /tmp/learning-ramp-fixture`, copy `scripts/benchmark-progression.cjs` and `scripts/simulate-rewards.cjs` into it, then run:

```sh
docker run --rm --network=none --cpus=1 --memory=2g \
  -v /tmp/learning-ramp-fixture:/work -w /work node:22-bookworm-slim \
  node benchmark-progression.cjs /work/results 1000 /work/engine.cjs \
  7be6bfab848f4cc894411052e69882258ebb50d4b7eaa78ee78b2e13222173e8
```

The source hash printed when creating the fixture must match the recorded hash before comparing this engine. Run database suites with an isolated `TEST_DATABASE_URL`, never a production database. No remote database operation is needed for this change.
