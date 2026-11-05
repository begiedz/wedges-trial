const { timingSafeEqual, createHash, randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { runSurvey } = require("./survey-locks.cjs");
const { CHESTS, runBenchmark } = require("./benchmark-locks.cjs");

function createHandler(engine, pool, engineSha256) {
  const instance = randomUUID();
  let invocations = 0;
  let busy = false;
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const expected = process.env.BENCHMARK_TOKEN;
    const supplied = req.headers.authorization ?? "";
    const digest = (value) => createHash("sha256").update(value).digest();
    if (
      !expected ||
      !timingSafeEqual(digest(supplied), digest(`Bearer ${expected}`))
    )
      return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET")
      return res.status(405).json({ error: "Method not allowed" });
    if (busy)
      return res.status(429).json({ error: "Benchmark already running" });
    const url = new URL(req.url, "https://benchmark.invalid");
    const chest = Number(url.searchParams.get("chest") ?? 19);
    const mode = url.searchParams.get("mode") ?? "engine";
    const seed = Number(url.searchParams.get("seed") ?? 28);
    if (
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed > 0xffffffff ||
      !CHESTS.includes(chest) ||
      !["engine", "database", "survey"].includes(mode)
    )
      return res.status(400).json({ error: "Invalid benchmark request" });
    busy = true;
    const invocation = ++invocations;
    const started = performance.now();
    try {
      let result;
      if (mode === "database") {
        // Read only; includes pool checkout, connection/TLS and SELECT round trip.
        // No session/run data, schema mutation, or forced Neon suspend.
        const start = performance.now();
        const probe = await pool.query(
          "SELECT pg_postmaster_start_time() AS started_at",
        );
        result = {
          databaseMs: performance.now() - start,
          databaseStartedAt: probe.rows[0].started_at,
        };
      } else if (mode === "survey") {
        result = runSurvey(engine, { chests: [chest], samples: 10, seed });
      } else
        result = runBenchmark(engine, {
          chests: [chest],
          samples: 10,
          seed,
          warmups: 0,
        });
      return res.status(200).json({
        instance,
        invocation,
        firstInvocation: invocation === 1,
        engineSha256,
        region: process.env.VERCEL_REGION ?? null,
        handlerMs: performance.now() - started,
        ...result,
      });
    } catch (error) {
      const allowed = [
        "ECONNREFUSED",
        "ENOTFOUND",
        "ETIMEDOUT",
        "28P01",
        "28000",
        "3D000",
        "ERR_INVALID_URL",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
      ];
      const failureCode = allowed.includes(error.code) ? error.code : "UNKNOWN";
      return res.status(503).json({ error: "Benchmark failed", failureCode });
    } finally {
      busy = false;
    }
  };
}
module.exports = { createHandler };
