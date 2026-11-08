# Lock validation and difficulty — post-#61 (2026-11-06)

> Preserved post-#61 baseline. New `learning-ramp-v1` progression and matched measurements are documented in the [2026-11-08 report](learning-progression-report.md).

Current 4–7-plate engine and four-mistake durability. [Historical #50 report](archive/2026-11-05-lock-validation.md), [historical #28 report](archive/2026-11-05-lock-benchmarks.md) and [archive manifest](../../benchmarks/results/archive/manifest.json) preserve the earlier 3–6-plate/three-mistake evidence. Raw bytes and measurement/provenance text are preserved; only relative report links were repaired.

## Contract and provenance

Final post-#61 engine, measured 2026-11-06T20:58:30.734Z (UTC). Source SHA256 over sorted `src/game/*.ts` names/contents: `a50822e29d6880fbab1f5bb275020ab6a7faf172c3cf4441ed635fcf8134e528`. Emitted engine SHA256: `29913a3930c8d5c6aa76cb54f9cd9693e26f9ceb84bd20d689285832ee195662`. Base commit: `b2ca1f826af1b2e0eb8899cbcd8e44f065c2924a` plus uncommitted #61 changes; the source hash, not the base commit alone, identifies the measured engine.

Runtime: v22.23.4, Linux arm64, cached `node:22-bookworm-slim` image in Docker on Apple M1, `--network=none --cpus=1 --memory=2g`. Runs are sequential, after final code/tests/typecheck/lint/build, with no competing test/build work. The benchmark, survey and simulation execute successively in one Node process; later RSS is the cumulative process high-water mark, including earlier work and untimed validation. This is a bounded local environment, not Vercel hardware or deployed throughput. No current Preview/Neon measurement, production deployment or migration was performed. Historical Preview/database results are archived and do not measure this engine.

`solveLockDetailed` retains found/budget-exhausted/unsolvable outcomes, complete BFS layers, legal path replay and a 20,000-state cap. Generation retains 12 attempts, bounded mixing and a verified construction witness. Construction-only fallback stores null optimum; requested minima remain targets. No solver cap/retry change or extra-valid-move penalty is introduced.

The #50 seeded survey runs 1,000 locks at each of ten chests (10,000 total): 1, 5, 6, 12, 13, 24, 25, 100, 1,000, 10,000. Seed 50; sample RNG seed `(50 + chest * 100003 + sample) >>> 0`. No discarded warmups. Every construction witness is replayed through actual movement; independent final-layout BFS checks optimum agreement. Independent solving and action replay are outside generation timing. See [benchmark reproduction and latency gates](lock-benchmarks.md).

## Actual difficulty and fallbacks

Each row has 1,000 locks. Shortest lengths include only independently found optima; unavailable optimum is never guessed. Capped searches count internal candidate searches, not unsolvable locks.

| Chest | Plates | Target | Verified length min / p50 / p95 / max | Below target | Unverified fallback | Capped candidates | Attempts max | Repeated layouts / rules | Independent locks | Mean cross effects/rule |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 2–4 | 2 / 4 / 4 / 4 | 0.0% | 0 | 0 | 1 | 14 / 504 | 0 | 0.64 |
| 5 | 4 | 5–7 | 5 / 6 / 7 / 7 | 0.0% | 0 | 0 | 10 | 4 / 156 | 0 | 1.09 |
| 6 | 5 | 5–8 | 5 / 8 / 8 / 8 | 0.0% | 0 | 0 | 6 | 0 / 0 | 0 | 1.54 |
| 12 | 5 | 7–10 | 6 / 10 / 10 / 10 | 0.4% | 0 | 0 | 12 | 0 / 0 | 0 | 2.08 |
| 13 | 6 | 8–10 | 8 / 10 / 10 / 10 | 0.0% | 0 | 1 | 12 | 0 / 0 | 0 | 2.72 |
| 24 | 6 | 10–13 | 8 / 12 / 13 / 13 | 0.7% | 0 | 0 | 12 | 0 / 0 | 0 | 3.35 |
| 25 | 7 | 10–13 | 8 / 12 / 13 / 13 | 0.3% | 0 | 25 | 12 | 0 / 0 | 0 | 4.11 |
| 100 | 7 | 16–19 | 9 / 16 / 19 / 19 | 49.6% | 0 | 44 | 12 | 0 / 0 | 0 | 5.26 |
| 1000 | 7 | 25–28 | 9 / 17 / 24 / 28 | 95.3% | 0 | 106 | 12 | 0 / 0 | 0 | 5.24 |
| 10000 | 7 | 35–38 | 9 / 17 / 25 / 35 | 99.9% | 0 | 155 | 12 | 0 / 0 | 0 | 5.24 |

| Chest | Generation wall p50 / p95 / max (ms) | CPU p50 / p95 / max (ms) | Final searches found / capped | Max final search states |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0.10 / 0.23 / 0.56 | 0.10 / 0.34 / 1.55 | 1000 / 0 | 76 |
| 5 | 0.33 / 0.93 / 2.27 | 0.33 / 0.96 / 4.32 | 1000 / 0 | 316 |
| 6 | 0.55 / 1.61 / 6.36 | 0.56 / 1.66 / 5.07 | 1000 / 0 | 1019 |
| 12 | 1.21 / 3.29 / 34.29 | 1.23 / 3.52 / 9.22 | 1000 / 0 | 1692 |
| 13 | 1.81 / 6.61 / 37.40 | 1.86 / 6.73 / 39.91 | 1000 / 0 | 3784 |
| 24 | 3.38 / 10.76 / 26.08 | 3.49 / 10.59 / 36.03 | 1000 / 0 | 6895 |
| 25 | 5.77 / 28.78 / 91.45 | 6.09 / 25.22 / 109.79 | 1000 / 0 | 13907 |
| 100 | 21.72 / 54.27 / 2043.82 | 22.10 / 52.84 / 1576.95 | 1000 / 0 | 19613 |
| 1000 | 36.18 / 80.44 / 1229.88 | 36.04 / 80.51 / 874.45 | 1000 / 0 | 19956 |
| 10000 | 41.49 / 89.41 / 167.24 | 39.19 / 87.63 / 193.57 | 1000 / 0 | 19959 |

Total capped candidate searches: 331; unverified generation fallbacks: 0; optimum mismatches: 0. Every witness legally solved its lock. Process high-water RSS 123.43 MiB includes earlier benchmark work. Forced-cap unit tests also replay seven-plate construction fallbacks; finite surveys do not prove all future solver calls will find an optimum.

## Comparison with archived #50

Compare common chests only. Both use 1,000 samples/chest and seed 50, but different plate counts. Original local #50 runtime was macOS Node 24; current runtime is one-CPU Linux Node 22. Wall/CPU changes across those environments are descriptive, not isolated engine speed effects; use the matched-family #28 comparison for latency regression review.

| Chest | Old → new verified min / p50 / p95 / max | Old → new below-target rate | Old → new candidate caps | Old → new unverified fallback |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2 / 4 / 4 / 4 → 2 / 4 / 4 / 4 | 0.0% → 0.0% | 0 → 0 | 0 → 0 |
| 5 | 5 / 6 / 7 / 7 → 5 / 6 / 7 / 7 | 0.0% → 0.0% | 0 → 0 | 0 → 0 |
| 25 | 8 / 12 / 13 / 13 → 8 / 12 / 13 / 13 | 0.3% → 0.3% | 1 → 25 | 0 → 0 |
| 100 | 7 / 15 / 19 / 19 → 9 / 16 / 19 / 19 | 59.1% → 49.6% | 2 → 44 | 0 → 0 |
| 1000 | 9 / 17 / 26 / 28 → 9 / 17 / 24 / 28 | 92.7% → 95.3% | 5 → 106 | 0 → 0 |
| 10000 | 7 / 17 / 27 / 38 → 9 / 17 / 25 / 35 | 99.1% → 99.9% | 3 → 155 | 0 → 0 |

Original #50 local worst generation p95 83.87 ms / max 493.74 ms, RSS 279.67 MiB; current 89.41 / 2043.82 ms and 123.43 MiB. Both raw datasets retain CPU times and full per-chest distributions. Late target attainment regresses: chest 1,000 below-target rate rises from 92.7% to 95.3%, and chest 10,000 from 99.1% to 99.9%. Candidate cap counts rise (3 → 155 at chest 10,000), although every surveyed final lock has a verified optimum. These are difficulty/search regressions; seven plates alone do not guarantee harder locks or human calibration. Existing #48 owns further target tuning. No minimum was silently weakened.

## Resource sustain

The original #47 simulation script/raw dataset was absent at the start of #61; its published aggregates remain in [gameplay history](gameplay.md#historical-resource-simulation-47-pre-61). The new checked-in `scripts/simulate-rewards.cjs` compares three- and four-mistake durability with identical per-run seeds and actual engine ore/pick reward functions. Seed 47; run seed `(47 + sample) >>> 0`; 10,000 runs/profile, cap 1,000 credited chests; starts with three picks and carries damage. A last-pick break ends the run before loot. Every surviving chest is solved and continued. Cap survivors are censored, not finished ranking entries. Fixed mistakes/chest model resources only, not puzzle difficulty, human skill or score fairness. This rerun is traceable but is not claimed to reproduce the missing original script byte-for-byte.

| Durability | Mistakes/chest | Median / p95 credited chests | Censored at 1,000 | Median / p95 ore |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 0 | 1000 / 1000 | 100.00% | 2507500 / 2507500 |
| 3 | 1 | 1000 / 1000 | 93.17% | 2256500 / 2256500 |
| 3 | 2 | 10 / 43 | 0.00% | 260 / 3956 |
| 3 | 3 | 3 / 9 | 0.00% | 31 / 187 |
| 3 | 6 | 1 / 2 | 0.00% | 4 / 10 |
| 4 | 0 | 1000 / 1000 | 100.00% | 2507500 / 2507500 |
| 4 | 1 | 1000 / 1000 | 99.32% | 2256500 / 2256500 |
| 4 | 2 | 35 / 1000 | 9.56% | 2660 / 2006000 |
| 4 | 3 | 7 / 25 | 0.00% | 121 / 1219 |
| 4 | 6 | 1 / 3 | 0.00% | 4 / 18 |

Expected replenishment remains 0.5 picks/chest. Four-mistake durability shifts the nominal resource balance from 1.5 to 2 mistakes/chest before truncation. Longer survival and higher ore under fixed mistakes are an intended balance effect, not an ore-formula change. Perfect runs still have no designed end; random replenishment and automation risks remain open. There is one main ranking; these historical simulations are measurement comparisons, not separate player rankings.

## Issue #61 acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Chests 1–5 have 4 plates | PASS | Difficulty boundary tests and final survey chests 1/5. |
| Chests 6–12 have 5 plates | PASS | Boundary tests and final survey 6/12. |
| Chests 13–24 have 6 plates | PASS | Boundary tests and final survey 13/24. |
| Chests 25+ have 7 plates | PASS | Boundary, generated-path tests and survey 25/100/1000/10000. |
| Plate count never exceeds 7 | PASS | Capped band-derived count; monotonic/range tests. |
| Difficulty UI boundaries match locks | PASS | Authoritative continuation tests at 5/12/24 check displayed chest/band/count; debug display corrected to use one-based index directly. |
| Exactly fourth invalid move breaks pick | PASS | Pure and authoritative engine tests; real PostgreSQL finalization and replay. |
| Valid moves never heal | PASS | apply-move regression at three damage. |
| Reset/continuation preserve partial damage | PASS | Pure, server, prediction and PostgreSQL refresh/reset/continue tests. |
| Last broken pick ends run | PASS | Engine, PostgreSQL HTTP/socket batching, rollback and immutable terminal tests. |
| Seven-plate locks remain solvable | PASS | Boundary/late tests, forced-cap witness replay and 10,000-lock survey. |
| Performance benchmarked within existing budgets | FAIL | [Current gate decision](lock-benchmarks.md#budget-decision-and-limits); both surveys exceeded the maximum latency gate despite passing p95; no solver/retry increase. |
| Final #28/#50/#47 reruns include new boundaries/late seven-plate cases | PASS | Raw current benchmark (100 samples/chest), survey (1000/chest), paired resource simulation (10000/profile) generated after final source tests/build. |
| Historical reports/raw archived and linked | PASS | Date-based 2026-11-05 archives; original raw SHA256 verified before replacement; index and relative report links repaired. |
| Current reports include provenance and comparisons | PASS | These canonical reports; metadata source/emitted hashes, base commit, runtime, seeds, samples, limits, CPU/RSS, regressions and historic comparisons. |
| Existing scoring/rewards unchanged | PASS | Ore/pick reward source unchanged; reward, lifecycle, replay and ranking-order tests pass; the single main ranking retains the existing ruleset identifier. |
| Four locales describe mechanics accurately | PASS | EN/PL/DE/RU instructions say four mistakes; keys/types unchanged. Indicators read the four-mistake server durability; non-four-point snapshots are rejected. |
| Relevant tests pass | PASS | Final `pnpm test` and `pnpm test:coverage`: 331 tests each, including all 21 PostgreSQL integration tests. Typecheck, lint/names/architecture and webpack production build pass. Existing cursor CSS lint warning remains. |

No browser/device end-to-end, current Preview/Neon or production verification was performed. No public API fields, SQL schema or migration changed. Gameplay uses four-mistake durability and the 4–7-plate progression. The main ranking uses `deterministic-ore-v1`. See the [pre-release decision](decisions.md#approved-progression-and-durability--2026-11-06-61). No GitHub issue mutation or deployment is implied.

Issue #61 is not fully signed off on performance: both full surveys exceeded the maximum investigation gate (1,481.88 ms and 2043.82 ms), although p95 remained under 100 ms. The [first slow seed](lock-benchmarks.md#same-engine-latency-outlier-and-repeat) did not reproduce the spike in targeted checks. Both full runs are retained; long-tail performance needs investigation before production.
