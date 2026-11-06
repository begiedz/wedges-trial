# Lock validation and difficulty evidence (#50)

## Implemented contract

`solveLockDetailed()` distinguishes `found`, `budget-exhausted` and `unsolvable`. Only exhausting a reachable frontier proves that no path exists. Complete bidirectional BFS layers establish shortest distance; reconstruction is replayed with the same atomic movement evaluator used by gameplay before returning `found`. The default cap remains 20,000 stored search nodes across both frontiers. The compatibility `solveLock()` returns a path/null for existing debug/test callers; null remains ambiguous and authoritative generation no longer uses it.

`createLockWithDiagnostics()` exposes private, ephemeral generation evidence for offline tooling: attempt count, found/capped candidate searches, target range and `target-met` / `below-target` / `unverified` outcome. It also retains a legal solution witness, including the inverse mixing walk for construction-only fallbacks. Every returned witness is replayed. `createLock()` returns only the existing lock shape; paths/diagnostics are neither persisted nor added to public DTOs. Owner-visible dependency rules remain necessary for prediction; optima remain private.

At most 12 candidate searches are performed, each with the same state cap. The random walk is still bounded to four times the configured scramble length. No retry-until-success loop or larger BFS cap is introduced. A generated-but-proven-unreachable candidate is an invariant violation and fails closed, rather than being treated as a weak puzzle.

## Difficulty policy and compatibility

Retain the existing bounded fallback for this cohort: prefer the longest verified candidate within the maximum, otherwise use the first construction-bounded layout with `optimalMoves: null`. The requested minimum is a target, not a guaranteed property. This preserves the approved ruleset and random selection behavior; the measurements below expose shortfalls rather than quietly changing difficulty or claiming all late chests satisfy their targets. Stricter rejection, revised late targets, milestone tiers and human difficulty calibration remain product decisions under #48. Larger budgets are not justified merely by an unattainable minimum.

A found shortest path may be shortened by following its prefix; the remaining suffix retains proven shortest distance. Construction witness length is only an upper bound and never fills `optimalMoves`. Neither verified nor unavailable optima incur extra-valid-move penalties: deterministic-ore-v1 still uses cumulative invalid moves only. No reward, replenishment, public contract, stored shape, schema, migration or ranking cohort change is introduced. Rollback reverts code/tooling while retaining existing runs, metrics, results and replay history.

## Reproduction

`node scripts/survey-locks.cjs 1000 /tmp/lock-survey-local.json` runs 1,000 seeds at each of the 12 existing benchmark chests (12,000 generated locks). It uses the #28 transpiled engine harness and LCG: `sampleSeed = (50 + chest * 100003 + sample) >>> 0`. Node startup/transpilation, independent final-layout BFS and actual gameplay action replay are outside generation timing. No timing warmups are discarded; retain raw timings and source hash. Reported RSS is the whole-process high-water mark, including untimed validation, rather than per-lock allocation.

Each report contains target/actual shortest-distance summaries, fallback/search-cap counts, attempt distributions, mean non-source effects per rule, fully independent locks and repeated layouts/rule sets. A repeated layout means identical ordered initial positions and rules within that chest's corpus, not mathematical equivalence under pin permutations. Rule hashes allow reproducibility checks without retaining solutions. Finite samples cannot establish collision-free randomness or human difficulty.

The existing standalone fixture now accepts `mode=survey`, still bounded to ten samples of one allowed chest/request and requiring its private bearer token plus Vercel protection. Use `node scripts/create-benchmark-preview.cjs <empty-temp-dir>`, following [Preview deployment/cleanup instructions](2026-11-05-lock-benchmarks.md). For 100 distinct seeds/chest, request batches with `seed=50 + 10*batch`, `batch=0..9`. Never publish benchmark paths in the application. No database probes are needed for this pure-engine investigation.

Engineering thresholds remain #28's generation p95 <100 ms, observed max <500 ms and RSS below the 2 GiB function ceiling. They are investigation gates, not a production gameplay SLO. Generation remains synchronous and happens under gameplay transaction locks; this benchmark excludes Next.js startup, sockets, ownership checks and SQL commits. See #28 for platform/concurrency and billing caveats.

## Measured difficulty — 2026-11-05

Local survey: Node v24.21.0, macOS arm64, 1,000 samples/chest, seed 50. Every final lock had a found optimum, legal witness, optimum agreement and length within the requested maximum. There were 59,070 candidate searches, including 11 budget exhaustions; no exhaustion was reported as unsolvable. Observed maximum final-layout search storage was 19,830 nodes; observed attempts never exceeded 12. Forced-exhaustion tests separately validate construction-only fallbacks, since none of the final survey locks needed one.

| Chest | Target | Actual min / p50 / p95 / max | Below target | Capped candidate searches | Repeated layouts / rules | Independent locks | Mean cross effects/rule |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 2–4 | 2 / 4 / 4 / 4 | 0.0% | 0 | 263 / 894 | 41 | 0.53 |
| 4 | 4–7 | 4 / 5 / 7 / 7 | 0.0% | 0 | 89 / 886 | 18 | 0.68 |
| 5 | 5–7 | 5 / 6 / 7 / 7 | 0.0% | 0 | 4 / 156 | 0 | 1.09 |
| 10 | 7–10 | 6 / 9 / 10 / 10 | 1.6% | 0 | 0 / 3 | 0 | 1.46 |
| 11 | 7–10 | 6 / 10 / 10 / 10 | 0.3% | 0 | 0 / 0 | 0 | 2.02 |
| 18 | 9–12 | 7 / 11 / 12 / 12 | 2.2% | 0 | 0 / 0 | 0 | 2.46 |
| 19 | 9–12 | 8 / 12 / 12 / 12 | 0.7% | 0 | 0 / 0 | 0 | 3.12 |
| 25 | 10–13 | 8 / 12 / 13 / 13 | 0.3% | 1 | 0 / 0 | 0 | 3.43 |
| 50 | 13–16 | 7 / 14 / 16 / 16 | 19.6% | 0 | 0 / 0 | 0 | 4.23 |
| 100 | 16–19 | 7 / 15 / 19 / 19 | 59.1% | 2 | 0 / 0 | 0 | 4.34 |
| 1,000 | 25–28 | 9 / 17 / 26 / 28 | 92.7% | 5 | 0 / 0 | 0 | 4.33 |
| 10,000 | 35–38 | 7 / 17 / 27 / 38 | 99.1% | 3 | 0 / 0 | 0 | 4.33 |

Dependencies saturate while median shortest distance levels off around 17 moves. Increasing requested length is not evidence of harder generated puzzles. High early repetition is expected in a small finite state/rule space, but means puzzle memorization remains a competitive risk; no sampled late layouts repeated. Fully independent locks were confined to early chests. No sampled lock was initially solved or one move from solved. These are reproducible corpus observations, not a human difficulty scale or a proof of long-run uniqueness.

Local generation's worst per-chest p95 was 83.87 ms, maximum 493.74 ms and process RSS 279.67 MiB. The local host was not CPU/memory isolated, and a short typecheck ran during the survey; use the deployed results below for the platform gate rather than treating this as a controlled platform comparison.

## Vercel Preview validation

Temporary immutable Preview `https://wedges-trial-qrd5pul2y-begiedz-dev.vercel.app`: Node v22.23.4, Linux x64, region iad1. 100 samples/chest (1,200 total), ten sequential requests/chest, ten samples/request, no discarded warmups. One function instance was observed; peak process RSS was 211.23 MiB. All 1,200 final searches found legal solutions with consistent optima; no final or candidate search exhausted its budget in this smaller subset.

| Chest | Generation p50 / p95 / max (ms) | Below target |
| --- | ---: | ---: |
| 1 | 0.21 / 0.87 / 8.66 | 0% |
| 4 | 0.31 / 1.13 / 7.50 | 0% |
| 5 | 0.65 / 3.02 / 12.35 | 0% |
| 10 | 1.64 / 4.65 / 11.80 | 4% |
| 11 | 3.00 / 12.47 / 23.77 | 1% |
| 18 | 5.16 / 12.69 / 30.00 | 0% |
| 19 | 11.25 / 30.39 / 63.29 | 1% |
| 25 | 11.65 / 34.53 / 47.30 | 0% |
| 50 | 20.77 / 42.52 / 86.83 | 16% |
| 100 | 26.29 / 51.57 / 68.23 | 60% |
| 1,000 | 39.27 / 73.85 / 94.58 | 89% |
| 10,000 | 40.33 / 83.70 / 167.97 | 99% |

**GO under the existing investigation gates**, with the added path validation included. No search budget increase is warranted. This does not establish concurrent gameplay throughput, a production SLO or human difficulty calibration.

Raw evidence: [12,000 local locks](../../../benchmarks/results/archive/2026-11-05/lock-survey-local.gz), [1,200 Preview locks](../../../benchmarks/results/archive/2026-11-05/lock-survey-preview.gz), gzip-compressed JSON. The measured TypeScript-source hash is `0675669505ee7c01b45a211e65e04f77d805d5e4c4db6a599d6ad266c2dd6887`; a subsequent explicit TypeScript filter predicate changes the final source hash to `4994d176b21b10d8e0cfae348884170db3cb6c98bea717232c425d71f41c3731`. Byte comparison confirmed identical emitted engine code, SHA256 `839938295e4b579cda8aaf35c34ef253ff929bd0288cc30d4531353694fb0028`. Both reports retain this provenance. Reproduction from final source has the latter source hash and the same runtime hash. Preview client timings initially include CLI startup (`cliRoundTripMs`), then direct HTTPS timings (`roundTripMs`); neither is used for the pure-generation gate.

## Acceptance evidence

| Issue #50 criterion | Status | Evidence |
| --- | --- | --- |
| Generated locks solvable by legal actions across representative seeds | PASS | Actual gameplay action replay on all 12,000 local and 1,200 Preview locks; forced construction-only fallback replay at chest 10,000. |
| Solver paths verified; null/budget handled explicitly | PASS | Runtime replay before `found`; three explicit outcomes; exhaustive reference BFS on all 81 start/target pairs in each of 16 small directed/inverse fixtures (1,296 cases), plus existing seeded two/three-pin fixtures. Generation fails closed on impossible unsolvability. |
| Actual vs target difficulty/fallback rates measured | PASS | Per-chest seeded distributions, below-target outcomes, candidate cap counts, attempts, repetitions and dependency statistics above and in raw reports. Retain existing bounded fallback; #48 owns a future curve decision. |
| Runtime/resource limits maintained; bounded retries | PASS | Existing 12-attempt / 20,000-state bounds, unit regressions, late Preview p95 83.70 ms / max 167.97 ms, process RSS 211.23 MiB. |
| No unfair optimum-based move penalty | PASS | Rewards unchanged; verified optimum only on found shortest paths, null for construction-only fallback. Reward/reset/server regression suite passes. |

Verification: `pnpm test` and `pnpm test:coverage` each passed all 318 tests, including all 21 PostgreSQL integration tests against disposable PostgreSQL 17. Type checking, lint, naming/architecture checks and production build passed. Lint retains the existing cursor CSS warning. The restricted Turbopack build stalled and was stopped; the successful build and database tests ran outside the sandbox. A separate compatibility check compared 120 seeded locks across all 12 chests to HEAD and found exact equality of pins, rules, optima and durability fields. No browser/device end-to-end verification, Neon/production migration, production deployment or GitHub issue mutation was performed.


Cleanup completed: the benchmark Preview was confirmed to have no aliases and was deleted; the task-created protection bypass was revoked without replacement. Temporary fixture/credential files and the disposable PostgreSQL container were removed. No application domain was assigned to the benchmark.
