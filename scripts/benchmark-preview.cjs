const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { CHESTS, summarize } = require("./benchmark-locks.cjs");

async function main() {
  const origin = new URL(process.env.BENCHMARK_URL);
  if (
    origin.protocol !== "https:" ||
    !origin.hostname.endsWith(".vercel.app") ||
    !process.env.BENCHMARK_TOKEN
  )
    throw new Error(
      "Set BENCHMARK_URL (HTTPS Vercel Preview) and BENCHMARK_TOKEN",
    );
  const output = process.argv[2];
  if (!output)
    throw new Error("Usage: node scripts/benchmark-preview.cjs <report.json>");
  const report = {
    date: new Date().toISOString(),
    deployment: origin.origin,
    engine: [],
    database: [],
  };
  const save = () =>
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  async function request(params) {
    const url = new URL("/api/benchmark", origin);
    url.search = new URLSearchParams(params).toString();
    const headers = { Authorization: `Bearer ${process.env.BENCHMARK_TOKEN}` };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
      headers["x-vercel-protection-bypass"] =
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const started = performance.now();
    const response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(310000),
    });
    if (!response.ok) {
      report.failures ??= [];
      report.failures.push({
        params,
        status: response.status,
        observedAt: new Date().toISOString(),
      });
      save();
      throw new Error(`Benchmark HTTP ${response.status}`);
    }
    const body = await response.json();
    return {
      ...body,
      roundTripMs: performance.now() - started,
      observedAt: new Date().toISOString(),
    };
  }
  for (const chest of process.argv.includes("--database-only") ? [] : CHESTS) {
    for (let batch = 0; batch < 10; batch++)
      report.engine.push(
        await request({ chest: String(chest), seed: String(28 + batch * 10) }),
      );
    save();
    console.log(`Measured Preview chest ${chest}`);
  }
  report.database.push({
    phase: "baseline",
    ...(await request({ mode: "database" })),
  });
  for (let i = 0; i < 20; i++)
    report.database.push({
      phase: "warm",
      ...(await request({ mode: "database" })),
    });
  save();
  for (let cycle = 0; cycle < 2; cycle++) {
    console.log(
      `Waiting six minutes without database probes for idle cycle ${cycle + 1}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 360000));
    const prior = report.database.at(-1);
    const resumed = await request({ mode: "database" });
    report.database.push({
      phase: "after-idle",
      idleWindowMs: 360000,
      restartObserved: resumed.databaseStartedAt !== prior.databaseStartedAt,
      ...resumed,
    });
    for (let i = 0; i < 10; i++)
      report.database.push({
        phase: "warm",
        ...(await request({ mode: "database" })),
      });
    save();
    console.log(`Recorded idle cycle ${cycle + 1}`);
  }
  report.summary = {};
  for (const phase of ["baseline", "warm", "after-idle"]) {
    const values = report.database.filter((row) => row.phase === phase);
    report.summary[phase] = {
      count: values.length,
      roundTripMs: summarize(values.map((row) => row.roundTripMs)),
      databaseMs: summarize(values.map((row) => row.databaseMs)),
    };
  }
  save();
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
