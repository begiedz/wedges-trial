# Lock generation benchmark — post-#61 (2026-11-06)

> Preserved post-#61 baseline. New `learning-ramp-v1` progression and matched measurements are documented in the [2026-11-08 report](learning-progression-report.md).

Current results for 4–7 plates and four invalid moves per pick. Historical [#28 report](archive/2026-11-05-lock-benchmarks.md) and [raw archive/checksums](../../benchmarks/results/archive/manifest.json) remain available; raw bytes are unchanged and report links are repaired.

## Provenance and method

Final post-#61 engine, measured 2026-11-06T20:58:30.734Z (UTC). Source SHA256 over sorted `src/game/*.ts` names/contents: `a50822e29d6880fbab1f5bb275020ab6a7faf172c3cf4441ed635fcf8134e528`. Emitted engine SHA256: `29913a3930c8d5c6aa76cb54f9cd9693e26f9ceb84bd20d689285832ee195662`. Base commit: `b2ca1f826af1b2e0eb8899cbcd8e44f065c2924a` plus uncommitted #61 changes; the source hash, not the base commit alone, identifies the measured engine.

Runtime: v22.23.4, Linux arm64, cached `node:22-bookworm-slim` image in Docker on Apple M1, `--network=none --cpus=1 --memory=2g`. Runs are sequential, after final code/tests/typecheck/lint/build, with no competing test/build work. The benchmark, survey and simulation execute successively in one Node process; later RSS is the cumulative process high-water mark, including earlier work and untimed validation. This is a bounded local environment, not Vercel hardware or deployed throughput. No current Preview/Neon measurement, production deployment or migration was performed. Historical Preview/database results are archived and do not measure this engine.

The #28 harness retains 100 measured samples/operation/chest and three discarded warmups. Chests are 1-based: 1, 5, 6, 12, 13, 24, 25, 100, 1,000, 10,000; generation receives `chest - 1`. Seed 28; sample RNG seed `(28 + chest * 100003 + sample) >>> 0`, using the harness LCG. Summaries are nearest-rank p50/p95/max; no outliers are removed. `createLock` includes solver/retries; independent `solveLock` and legal replay validate the generated lock. `openSolvedChest` times destination generation using a legally solved predecessor prepared outside the timer. It is a debug/legacy continuation helper, not authoritative SQL transaction timing. Preparation/replay are excluded from operation timings and included in process resources.

## Current timings

All timings are milliseconds, **p50 / p95 / max**. CPU is user + system CPU from raw createLock samples.

| Chest | Plates | createLock wall | createLock CPU | solveLock wall | continuation wall | Below target / unavailable optimum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 0.62 / 1.72 / 69.35 | 1.53 / 4.17 / 8.29 | 0.15 / 0.30 / 0.91 | — | 0 / 0 |
| 5 | 4 | 0.64 / 3.25 / 58.48 | 1.40 / 4.82 / 11.90 | 0.25 / 0.64 / 0.86 | 0.59 / 2.55 / 44.01 | 0 / 0 |
| 6 | 5 | 0.58 / 1.71 / 3.54 | 0.61 / 2.36 / 4.55 | 0.15 / 0.31 / 0.52 | 0.66 / 2.02 / 2.82 | 0 / 0 |
| 12 | 5 | 1.30 / 3.52 / 36.71 | 1.64 / 4.33 / 10.23 | 0.27 / 0.89 / 2.54 | 1.30 / 3.90 / 45.90 | 0 / 0 |
| 13 | 6 | 1.75 / 5.97 / 10.17 | 1.85 / 7.10 / 18.33 | 0.79 / 1.65 / 7.40 | 1.68 / 8.19 / 18.82 | 0 / 0 |
| 24 | 6 | 3.52 / 10.16 / 16.65 | 3.68 / 10.60 / 20.48 | 1.27 / 3.49 / 9.25 | 3.33 / 7.75 / 16.46 | 0 / 0 |
| 25 | 7 | 5.53 / 32.12 / 101.65 | 5.84 / 29.62 / 103.55 | 3.39 / 8.60 / 27.72 | 5.91 / 28.86 / 48.59 | 0 / 0 |
| 100 | 7 | 20.82 / 45.75 / 68.65 | 22.42 / 39.19 / 52.01 | 5.23 / 20.93 / 42.87 | 20.65 / 48.23 / 66.56 | 52 / 0 |
| 1000 | 7 | 32.52 / 71.64 / 92.04 | 31.52 / 68.66 / 95.47 | 6.02 / 21.09 / 33.72 | 31.06 / 68.98 / 86.25 | 99 / 0 |
| 10000 | 7 | 37.06 / 70.33 / 75.73 | 33.60 / 68.64 / 78.87 | 7.26 / 26.64 / 36.85 | 35.27 / 72.92 / 94.07 | 100 / 0 |

Whole benchmark: 45.27 seconds; high-water RSS 110.82 MiB. Independent solver nulls: 0. Null means unverified at the cap, never proven unsolvable. See the [10,000-lock survey](lock-validation.md) for internal exhaustion/fallback and optimum distributions.

## Comparison with archived #28

Same sample count, seed rule, one-CPU/2 GiB Docker Node 22 environment and host family; timings still vary with host load/runtime conditions. Compare only shared chest numbers; their plate counts intentionally differ. This is an engine/corpus comparison, not a controlled human difficulty comparison. Survey #50 used macOS Node 24 locally, so its latency cannot establish a same-environment speed ratio.

| Chest | Old → new plates | Old create p50 / p95 / max | New create p50 / p95 / max | Old CPU p50 / p95 / max | New CPU p50 / p95 / max | p95 change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 → 4 | 0.47 / 1.57 / 3.62 | 0.62 / 1.72 / 69.35 | 0.87 / 3.17 / 5.44 | 1.53 / 4.17 / 8.29 | +9.6% |
| 5 | 4 → 4 | 0.78 / 3.52 / 26.67 | 0.64 / 3.25 / 58.48 | 1.03 / 4.39 / 8.43 | 1.40 / 4.82 / 11.90 | -7.7% |
| 25 | 6 → 7 | 8.59 / 30.02 / 214.33 | 5.53 / 32.12 / 101.65 | 8.70 / 28.32 / 161.17 | 5.84 / 29.62 / 103.55 | +7.0% |
| 100 | 6 → 7 | 27.76 / 81.79 / 276.23 | 20.82 / 45.75 / 68.65 | 26.69 / 82.83 / 229.03 | 22.42 / 39.19 / 52.01 | -44.1% |
| 1000 | 6 → 7 | 31.32 / 60.19 / 133.78 | 32.52 / 71.64 / 92.04 | 30.14 / 60.30 / 138.98 | 31.52 / 68.66 / 95.47 | +19.0% |
| 10000 | 6 → 7 | 32.53 / 78.53 / 123.86 | 37.06 / 70.33 / 75.73 | 32.03 / 77.51 / 138.83 | 33.60 / 68.64 / 78.87 | -10.4% |

Old benchmark RSS 99.46 MiB → current 110.82 MiB. Raw samples preserve per-operation CPU for both versions; current CPU summaries are above.

## Budget decision and limits

**NO-GO under the existing #28 investigation gates**: generation/continuation p95 <100 ms, observed max <500 ms, process RSS <2 GiB. Benchmark worst p95 72.92 ms / max 101.65 ms; larger survey worst p95 89.41 ms / max 2043.82 ms, cumulative RSS 123.43 MiB. At least one gate fails; do not declare issue #61 complete or infer production readiness. No budget was increased.

Latency increases in the comparison table are regressions, even when inside a gate. Generation remains synchronous CPU work under authoritative transaction locks; pure engine timings exclude framework/session/SQL/socket work and concurrency. Free-tier CPU/memory quotas and cold starts are not retested. Archived platform observations remain historical only. Solver cap 20,000 and retries 12 are unchanged. Difficulty targets are not guarantees; no optimum-based score penalty is introduced.

## Solver bookkeeping optimization

The solver uses collision-free mixed-radix numeric keys for safe integer state spaces and checks bounds/visited neighbors before allocating vectors. Large/debug state spaces retain string keys; duplicate effects are aggregated atomically. Search order, complete BFS layers, reconstruction/replay and 20,000-state/12-attempt caps are unchanged. Exhaustive reference BFS tests and negative/heterogeneous/large-range regressions validate correctness. The final measurements above follow all checks.

## Reproduction and evidence

```sh
pnpm benchmark:locks 100 /tmp/lock-engine.json
node scripts/survey-locks.cjs 1000 /tmp/lock-survey.json
node scripts/simulate-rewards.cjs /tmp/resource-sustain.json
```

For the bounded runtime, generate the existing isolated fixture with `node scripts/create-benchmark-preview.cjs /tmp/empty-fixture`, copy `scripts/simulate-rewards.cjs` there, and run the emitted `engine.cjs` through `runBenchmark`, `runSurvey` and `simulateResources` in `node:22-bookworm-slim` with the limits above. Each function is exported by its matching script. Set `metadata.engineSha256` from the fixture's printed source hash. Do not deploy the fixture to reproduce a local CPU measurement. Historical Preview procedures remain in the [archived report](archive/2026-11-05-lock-benchmarks.md).

Raw current evidence: [benchmark](../../benchmarks/results/lock-engine-node22-linux.gz), [survey](../../benchmarks/results/lock-survey-local.gz), [sustain](../../benchmarks/results/resource-sustain.gz). All are gzip-compressed JSON with raw samples, seeds and metadata. No engine source change follows these final measurements. See [acceptance evidence](lock-validation.md#issue-61-acceptance-evidence).

## Same-engine latency outlier and repeat

The first survey on this same final source recorded a 1,481.88 ms generation sample at chest 100, seed 10001112 (CPU 1,433.18 ms), exceeding the 500 ms investigation gate despite p95 87.19 ms. Its [complete raw survey](../../benchmarks/results/archive/2026-11-06/lock-survey-local-2055.gz), [benchmark](../../benchmarks/results/archive/2026-11-06/lock-engine-node22-linux-2055.gz) and [resource simulation](../../benchmarks/results/archive/2026-11-06/resource-sustain-2055.gz) are preserved. Thirty [exact-seed checks](../../benchmarks/results/archive/2026-11-06/outlier-check-2055.gz) observed a maximum 212.13 ms; they did not reproduce or explain the original spike.

The full benchmark, 10,000-lock survey and resource simulation were then repeated once with identical source, seeds, sample counts and resource limits. Current tables/raw artifacts show that repeat, without removing any outliers within either run. The full repeat also exceeded the maximum gate (2043.82 ms), despite passing p95. The slow behavior is not confined to the one targeted seed. Neither full run passes every investigation gate; long-tail performance requires investigation before production. No raw observations were discarded.
