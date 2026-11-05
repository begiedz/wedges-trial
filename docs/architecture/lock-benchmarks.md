# Lock generation benchmark (#28) — 2026-11-05

The harness measures the current engine without changing generation, solver budgets, difficulty, rewards or persistence. This is a performance investigation, not a gameplay migration or production release.

## Method

Chest numbers in this report are **1-based**; generation receives `chest - 1`. The corpus covers both sides of all pin-count thresholds, six-pin locks and very late endless indices: 1, 4, 5, 10, 11, 18, 19, 25, 50, 100, 1000, 10000. Each operation has 100 measured samples per chest (except continuation into chest 1, which does not exist). Seed is 28; sample RNG seed is `(28 + chest * 100003 + sample) >>> 0`, using the documented LCG in the harness. The corpus is reproducible; timings vary with load and runtime.

`createLock()` includes its internal solver and retries. `solveLock()` independently measures solving that generated lock with the default 20,000-state budget; results are replayed legally outside the timer. `openSolvedChest()` receives a legitimately solved predecessor prepared outside the timer and generates the destination chest. It rolls legacy rewards as implemented; authoritative server continuation now calls `createLock()` directly and credits an existing reward, so the legacy helper is not a database transaction benchmark. Preparation is excluded from per-operation timings but included in whole-harness duration and memory.

The local CLI transpiles the actual `src/game/*.ts` modules to CommonJS before timing. The Preview fixture runs the same emitted modules without TypeScript or Vitest instrumentation. SHA256 over ordered source names/contents: `4ad39b7f36977a77079dde1064a29dd9c84cc5a2c73cc4381d239e70cb68ddce`. Raw samples retain wall and CPU time, RNG seed and operation. Summaries use nearest-rank p50/p95 and population standard deviation; no outliers are removed. Local runs discard three warmups per chest. Preview uses ten batches of ten distinct seeds, no discarded warmups; its first-invocation flag identifies a new module instance, not a guaranteed platform cold start.

## Controlled Linux Node 22 results

Node v22.23.4, Linux ARM64 in Docker, `--cpus=1 --memory=2g`, Apple M1 host. This limits CPU scheduling and memory but is not an emulation of Vercel hardware. Measured 68.4 s total; process high-water RSS 99.5 MiB.

All timing columns are milliseconds. Each operation cell is **p50 / p95 / max**.

| Chest | Pins | createLock | solveLock | openSolvedChest | Below requested minimum |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 0.47 / 1.57 / 3.62 | 0.11 / 0.29 / 6.15 | — | 0/100 |
| 4 | 3 | 0.32 / 1.03 / 2.12 | 0.06 / 0.33 / 0.79 | 0.28 / 0.93 / 1.43 | 0/100 |
| 5 | 4 | 0.78 / 3.52 / 26.67 | 0.25 / 0.88 / 24.87 | 0.77 / 2.28 / 3.97 | 0/100 |
| 10 | 4 | 1.74 / 4.64 / 22.23 | 0.50 / 1.43 / 3.73 | 1.61 / 4.61 / 8.92 | 2/100 |
| 11 | 5 | 2.37 / 8.65 / 30.77 | 1.28 / 3.09 / 4.16 | 1.86 / 6.90 / 10.81 | 1/100 |
| 18 | 5 | 5.63 / 13.98 / 53.26 | 2.14 / 6.07 / 10.97 | 5.98 / 19.72 / 50.87 | 0/100 |
| 19 | 6 | 7.92 / 20.78 / 29.37 | 4.36 / 9.91 / 20.83 | 7.92 / 27.69 / 82.90 | 3/100 |
| 25 | 6 | 8.59 / 30.02 / 214.33 | 5.14 / 19.43 / 27.06 | 7.78 / 37.90 / 156.73 | 0/100 |
| 50 | 6 | 19.54 / 67.54 / 137.63 | 8.28 / 45.32 / 201.21 | 21.12 / 65.87 / 170.57 | 16/100 |
| 100 | 6 | 27.76 / 81.79 / 276.23 | 9.35 / 31.11 / 87.77 | 26.73 / 82.08 / 156.94 | 60/100 |
| 1000 | 6 | 31.32 / 60.19 / 133.78 | 8.31 / 27.93 / 73.13 | 28.57 / 66.96 / 92.86 | 90/100 |
| 10000 | 6 | 32.53 / 78.53 / 123.86 | 9.65 / 35.40 / 69.24 | 33.17 / 71.89 / 143.72 | 99/100 |

No independently measured solver call returned null, and no generated lock had unavailable optimum metadata in this corpus. This does not establish that internal candidate searches never exhaust their budgets: the harness does not instrument internal retries. Late requested minima often cannot be met; construction fallback/verified best-candidate behavior is preserved. These difficulty observations belong to existing #48/#50 calibration work, not a new rule or optimum penalty.

## Reproduce

From the repository root, using pnpm 10.18.3 and the frozen lockfile:

```sh
pnpm install --frozen-lockfile
pnpm benchmark:locks 100 /tmp/lock-engine-local.json
```

The first argument is samples per chest (1–1000); the second is the JSON output path. Default seed is 28. Startup/transpilation is excluded from operation timing. Run on an otherwise quiet host; do not run tests, builds or competing benchmarks at the same time when comparing performance.

To run the emitted engine in a CPU/memory-bounded Linux Node 22 runtime without adding dependencies to the project:

```sh
BENCHMARK_DIR=$(mktemp -d /tmp/wedges-benchmark.XXXXXX)
node scripts/create-benchmark-preview.cjs "$BENCHMARK_DIR"
docker run --rm --network=none --cpus=1 --memory=2g \
  -v "$BENCHMARK_DIR:/bench:ro" -w /bench node:22-bookworm-slim \
  node -e 'const b=require("./benchmark-locks.cjs"); console.log(JSON.stringify(b.runBenchmark(require("./engine.cjs")), null, 2))' \
  > /tmp/lock-engine-node22.json
```

The image must already be available (or pulled explicitly). The fixture generator prints the source hash; retain it alongside the report. Container CPU architecture, image patch version, host contention and power management affect results; retain the report metadata and explicit limits. RSS is the whole benchmark process high-water mark, not a per-request allocation or Vercel billed memory metric.

For Preview, the same generator creates a **temporary standalone fixture**, outside the Next.js application. Its static output contains only a placeholder index; engine files are function-only. It pins Node 22 and the installed pg version, limits each request to one allowed chest and ten samples, requires `BENCHMARK_TOKEN`, rejects concurrent work within one instance and never accepts game state. Keep Vercel deployment protection enabled. Link the temporary directory to the intended project, deploy to **Preview only**, and use the intended branch's Preview database configuration. For the linked project, the two database variables are sensitive and scoped to `development`; CLI environment exports produce empty values. Do not override the deployment with those empty exports or try to decrypt unrelated secrets. The successful fixture was a temporary local Git repository on branch `development` with the existing repository origin; Vercel inherited its sensitive branch configuration directly. This local fixture commit was never pushed. Deployment and credential use require authorization; do not use production credentials. No migration is required.

For the branch-scoped configuration used in this run (execute these commands only in the generated temporary directory):

```sh
git -C "$BENCHMARK_DIR" init --initial-branch=development
git -C "$BENCHMARK_DIR" remote add origin https://github.com/begiedz/wedges-trial.git
git -C "$BENCHMARK_DIR" add .
git -C "$BENCHMARK_DIR" -c user.name="Benchmark fixture" \
  -c user.email="benchmark@example.invalid" commit -m "Temporary issue 28 benchmark"
pnpm dlx vercel@54.14.2 link --cwd "$BENCHMARK_DIR" \
  --project wedges-trial --scope begiedz-dev --yes
# Generate BENCHMARK_TOKEN privately in the shell; never commit or print it.
pnpm dlx vercel@54.14.2 deploy --cwd "$BENCHMARK_DIR" --yes \
  --env "BENCHMARK_TOKEN=$BENCHMARK_TOKEN"
```

This creates no remote Git commit. Use the immutable URL printed by deploy; do not promote the fixture. The installed global CLI 33.5.2 was rejected by Vercel, so use the pinned 54.14.2 CLI. Merely passing `githubCommitRef` metadata without a real local branch did not inherit the sensitive database variables in this project. The fixture's `.gitignore` excludes environment files, local project links and dependencies.

Set `BENCHMARK_URL` to the immutable Preview URL, `BENCHMARK_TOKEN` to its private bearer token, and `VERCEL_AUTOMATION_BYPASS_SECRET` if protected; then run:

```sh
pnpm benchmark:preview /tmp/lock-engine-preview.json
# Or measure only the database on a separately prepared Preview:
pnpm benchmark:preview /tmp/neon-preview.json --database-only
```

Do not commit these environment values, CLI diagnostics or downloaded `.env` files. The runner executes 120 sequential engine requests (100 distinct seeds per chest), then a read-only database baseline, 20 warm probes and two six-minute idle cycles with 10 warm probes after each. It saves intermediate results after every chest and cycle. A failed request stops the run with a nonzero exit rather than silently dropping an outlier. There are no automatic retries. Client timing includes network/TLS/edge/function startup; `handlerMs` starts inside the handler; `databaseMs` includes checkout/connection/query time. These are different measurements, not additive components of a single operation.

The database probe reads only `pg_postmaster_start_time()` and never reads/writes sessions, runs or claims. Pools release idle connections after one second. Do not browse the application or run another database client during idle windows. Compare the returned postmaster timestamps before/after idle: a change corroborates a restarted compute; an idle delay alone cannot prove suspension. Other users, health checks and Neon maintenance can wake the shared development endpoint. Two wake samples provide examples, not a meaningful cold-latency p95. Warm database probes are a connection/query baseline, **not** full gameplay transaction or WebSocket latency. Remove the temporary Preview deployments and temporary secret files after collecting results.

## Deployed Preview engine results

Measured on immutable Preview `https://wedges-trial-jq2twczfs-begiedz-dev.vercel.app`, Vercel Hobby (`begiedz-dev`, plan verified through the team API), region `iad1`, Node v22.23.4, Linux x64, Intel Xeon, 2 visible logical CPUs. Engine source hash matches the local corpus. This standalone function tests the pure engine on the platform; it does not include Next.js loading, authorization, SQL transactions or gameplay transport.

| Chest | createLock p50 / p95 / max | solveLock p50 / p95 / max | openSolvedChest p50 / p95 / max |
| --- | ---: | ---: | ---: |
| 1 | 0.14 / 1.28 / 8.17 | 0.03 / 0.09 / 7.97 | — |
| 4 | 0.17 / 0.52 / 12.96 | 0.03 / 0.19 / 0.61 | 0.15 / 0.53 / 12.89 |
| 5 | 0.39 / 1.61 / 2.76 | 0.10 / 0.25 / 0.85 | 0.35 / 1.41 / 14.43 |
| 10 | 0.98 / 4.28 / 14.82 | 0.32 / 0.78 / 0.98 | 1.01 / 2.44 / 16.39 |
| 11 | 1.97 / 11.21 / 15.27 | 0.90 / 2.07 / 13.25 | 1.66 / 5.25 / 15.81 |
| 18 | 3.55 / 8.53 / 15.13 | 1.27 / 4.16 / 11.71 | 3.19 / 15.08 / 22.96 |
| 19 | 6.84 / 28.79 / 62.04 | 3.72 / 13.91 / 16.36 | 7.32 / 37.64 / 107.96 |
| 25 | 8.43 / 30.79 / 59.66 | 3.88 / 17.43 / 20.68 | 8.04 / 29.07 / 64.15 |
| 50 | 17.00 / 41.00 / 88.07 | 5.54 / 20.92 / 32.93 | 19.38 / 35.79 / 54.56 |
| 100 | 25.26 / 45.21 / 78.00 | 6.72 / 27.58 / 45.06 | 24.68 / 61.81 / 144.05 |
| 1000 | 39.25 / 68.07 / 87.55 | 8.85 / 38.14 / 61.52 | 36.41 / 83.57 / 118.58 |
| 10000 | 39.82 / 70.09 / 162.97 | 12.51 / 32.10 / 79.63 | 39.18 / 91.50 / 181.28 |

Peak reported process RSS: 217.4 MiB. The 120 batched engine requests had round-trip p50 / p95 / max 490.1 / 1910.2 / 2270.4 ms from the measurement client. These requests each do ten measured operations plus untimed verification/predecessor work, so those request times must not be described as single-lock game latency. The first module invocation took 17.91 ms inside the handler and 511.85 ms round trip; this includes ten early-chest samples. One first-invocation observation was recorded; no platform scale-to-zero assumption is made from that flag.

Raw engine reports (gzip-compressed JSON, with all samples): [Linux Node 22](../../benchmarks/results/lock-engine-node22-linux.gz) and [Vercel Preview](../../benchmarks/results/lock-engine-preview.gz). Read with `gzip -dc <path>` or `zlib.gunzipSync()`; compression changes no measurements.

## Warm function/database and auto-suspend recovery

The successful database-only run used immutable Hobby Preview `https://wedges-trial-eusdzj10p-begiedz-dev.vercel.app`, the same engine source hash, and the linked project’s sensitive development-branch Preview database variables. No database credential was exported. Earlier fixtures without usable branch configuration returned HTTP 503; that failed preflight is retained in the engine archive. A successful configuration probe preceded this series, so its baseline is not labeled cold.

| Measurement | Samples | Database p50 / p95 / max (ms) | Client round-trip p50 / p95 / max (ms) |
| --- | ---: | ---: | ---: |
| Warm | 40 | 76.67 / 79.21 / 80.24 | 282.48 / 464.82 / 531.26 |

| Idle cycle | Quiet window | Restart observed | Database (ms) | Handler (ms) | Client round trip (ms) | New postmaster start (UTC) |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 6 min | Yes | 1629.84 | 1629.93 | 2403.13 | 2026-11-05T21:18:44.930Z |
| 2 | 6 min | Yes | 1278.27 | 1278.40 | 2073.01 | 2026-11-05T21:24:51.036Z |

Both post-idle requests reached a new function instance and a restarted database compute. Their timings combine connection/TLS, query, database recovery and function/network overhead; they cannot isolate pure Neon activation or Next.js cold startup. Two recovery samples are insufficient for a useful cold-latency p95, even though the raw generic summary includes nearest-rank statistics. No errors occurred in the successful 43-request database series (one baseline, 40 warm, two post-idle). The evidence supports practical engine generation on Hobby while exposing a seconds-long first-request cost after suspension. It does not validate full gameplay or concurrent traffic.

Raw database evidence: [neon-preview.json](../../benchmarks/results/neon-preview.json). Preview deployments are temporary and retired after measurement; immutable URLs are provenance records, not live benchmark services.

## Decision and free-plan risks

**GO for server-side lock generation at the measured difficulties and sequential load.** The engineering review budget used here is p95 under 100 ms and observed maximum under 500 ms for pure generation/continuation, with process RSS well below the 2 GB function limit. This is an engineering decision for this investigation, not a new approved product latency guarantee or a formally preregistered statistical threshold. Both the controlled Linux run and deployed Preview meet it. No latency optimization issue is required by the conditional #28 scope. Existing #48/#50 still own late-game difficulty and solver calibration.

This does **not** establish production readiness or a traffic capacity guarantee. Pure engine timing omits Next.js initialization, session authorization, transactions, replay persistence, connection pooling and WebSocket work. Generation remains synchronous CPU work; it can block other work sharing the Node event loop, and server continuation holds transaction locks during generation. Measure burst/concurrent production-like gameplay before promising an end-to-end latency SLO. Batched benchmark requests include extra untimed verification and must not be used to predict billable production duration directly.

As checked on 2026-11-05, [Vercel function limits](https://vercel.com/docs/functions/limitations) document Hobby Fluid Compute's 300-second maximum duration, 2 GB maximum memory and a default single region. The [Hobby plan](https://vercel.com/docs/plans/hobby) includes 4 active CPU hours, 360 GB-hours of provisioned memory and one million function invocations; exceeding included usage can pause features until the usage period resets. These are account-wide constraints, not reserved game capacity. For scale intuition only, 50 ms of CPU per generation would consume four CPU hours after about 288,000 generations, before moves, sockets, rendering or other functions. Connection-heavy and long-lived socket traffic also consumes memory time; short generation times alone do not prove Hobby sustainability. No plan upgrade or billing change was made.

[Neon compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle) documents default suspension after five minutes without active queries, plus additional wake-up and cold-buffer latency. A six-minute quiet period is sufficient to attempt a wake measurement, but only observed restart evidence corroborates that the endpoint actually recycled. Region/network distance and warm connection reuse also matter; colocating the function and database should be assessed separately. No Neon compute setting, autosuspend policy or production database was changed.

## Scope and rollback

Only benchmark tooling, raw evidence and documentation are added. There is no gameplay, score, ruleset, public API, schema or migration change, and no benchmark route is added to the application. The Preview fixture requires a private bearer token and Vercel deployment protection. It accepts only bounded benchmark parameters, exposes no generated solutions or credentials, and performs a single read-only PostgreSQL uptime query in database mode. Reverting the source changes removes the tooling; delete the temporary fixture deployments and their local secret files after collection. No GitHub issue mutation or production deployment is part of this implementation.

## Issue #28 acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Reproducible commands and results checked into documentation | PASS | Local CLI, bounded Linux container and branch-scoped Preview instructions above; retained raw samples, runtime/source metadata, nearest-rank summaries and seeded corpus. |
| Slowest difficulty bands tested in Vercel-like Node and deployed Preview | PASS | Linux Node 22 with one CPU/2 GiB limits, plus actual Hobby Node 22 x64 Preview: 100 samples per operation per chest, six-pin thresholds through chest 10,000; legal solution replay. |
| Function latency and free-plan resource risks documented | PASS | Separate handler/client/query measurements, warm and idle-recovery observations, restart evidence, RSS, Hobby resource limits and CPU/memory/concurrency caveats; full gameplay transactions remain outside this benchmark. |
| Clear go/no-go for server-side generation | PASS | GO at measured difficulties/sequential load against the stated engineering budget; no game-rule change or production-readiness claim. Conditional latency optimization follow-up is not triggered. |

Verification: `pnpm test` and `pnpm test:coverage` each passed 290 tests, with 21 opt-in PostgreSQL integration tests skipped because `TEST_DATABASE_URL` was unset. `pnpm lint` (including names and architecture), `pnpm typecheck` and `pnpm build` passed. Lint retains the existing custom-cursor `!important` warning. The restricted Turbopack build stalled and was stopped; the successful build, Docker run and authorized Preview/Neon measurements ran outside the sandbox. No game/schema change, production deployment, migration or GitHub issue mutation was performed.

Cleanup completed: all five temporary benchmark Previews were deleted, the task-created protection bypass was revoked without replacement, and temporary fixture/environment/token files were removed. Deployment metadata showed no development or production aliases on the successful fixture. Credentials are absent from the retained evidence.
