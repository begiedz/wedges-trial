const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const {
  CHESTS,
  seededRandom,
  summarize,
  buildEngineSource,
  loadEngine,
} = require("./benchmark-locks.cjs");

// Same bounded corpus locally and in the private standalone Preview fixture.
function runSurvey(
  engine,
  { samples = 1000, chests = CHESTS, seed = 50 } = {},
) {
  if (
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 1000 ||
    !Number.isInteger(seed) ||
    !chests.length ||
    chests.some((chest) => !CHESTS.includes(chest))
  )
    throw new RangeError("Invalid survey configuration");
  const rows = [];
  const raw = [];
  for (const chest of chests) {
    const config = engine.getDifficultyForChest(chest - 1);
    const fingerprints = new Set();
    const ruleFingerprints = new Set();
    const lengths = [];
    const outcomes = { "target-met": 0, "below-target": 0, unverified: 0 };
    let budgetExhausted = 0;
    let fullyIndependent = 0;
    let shortestMismatch = 0;
    const measurements = [];
    const effects = [];
    const attempts = [];
    const visited = [];
    for (let i = 0; i < samples; i++) {
      const sampleSeed = (seed + chest * 100003 + i) >>> 0;
      const cpu = process.cpuUsage();
      const start = performance.now();
      const generated = engine.createLockWithDiagnostics(
        config,
        seededRandom(sampleSeed),
      );
      const ms = performance.now() - start;
      const used = process.cpuUsage(cpu);
      const { lock, solution, diagnostics } = generated;
      // Independently solve final layout, then replay through actual action handling.
      const solved = engine.solveLockDetailed(lock);
      let current = lock;
      for (const move of solution) {
        const result = engine.applyMoveToLock(
          current,
          move.pinId,
          move.direction,
        );
        if (result.kind !== "valid") throw new Error("Illegal survey witness");
        current = result.lock;
      }
      if (!engine.checkSolved(current))
        throw new Error("Incomplete survey witness");
      if (solved.kind === "unsolvable")
        throw new Error("Unsolvable generated lock");
      if (solved.kind === "found") {
        lengths.push(solved.solution.length);
        if (
          lock.optimalMoves != null &&
          solved.solution.length !== lock.optimalMoves
        )
          shortestMismatch++;
      }
      const coupled = lock.rules.map(
        (rule) =>
          rule.effects.filter((effect) => effect.pinId !== rule.sourcePinId)
            .length,
      );
      fullyIndependent += Number(coupled.every((n) => n === 0));
      effects.push(coupled.reduce((a, b) => a + b, 0) / coupled.length);
      const fingerprint = (value) =>
        createHash("sha256").update(JSON.stringify(value)).digest("hex");
      const ruleHash = fingerprint(lock.rules);
      ruleFingerprints.add(ruleHash);
      fingerprints.add(
        fingerprint([lock.pins.map((pin) => pin.position), ruleHash]),
      );
      outcomes[diagnostics.outcome]++;
      budgetExhausted += diagnostics.searches.budgetExhausted;
      measurements.push(ms);
      attempts.push(diagnostics.attempts);
      visited.push(solved.visitedStates);
      raw.push({
        chest,
        sample: i,
        seed: sampleSeed,
        ms,
        cpuMs: (used.user + used.system) / 1000,
        diagnostics,
        optimum: lock.optimalMoves,
        witnessLength: solution.length,
        finalSearch: solved.kind,
        finalVisitedStates: solved.visitedStates,
        meanCrossEffects: effects.at(-1),
        ruleHash,
      });
    }
    if (shortestMismatch) throw new Error("Optimum mismatch");
    rows.push({
      chest,
      config,
      outcomes,
      budgetExhausted,
      fullyIndependent,
      repeatedLocks: samples - fingerprints.size,
      repeatedRules: samples - ruleFingerprints.size,
      verifiedLength: lengths.length ? summarize(lengths) : null,
      generationMs: summarize(measurements),
      attempts: summarize(attempts),
      meanCrossEffects: summarize(effects),
      finalVisitedStates: summarize(visited),
      shortestMismatch,
    });
  }
  return {
    metadata: {
      date: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      samples,
      chests,
      seed,
      maxRssKiB: process.resourceUsage().maxRSS,
      memoryAtEnd: process.memoryUsage(),
    },
    rows,
    raw,
  };
}
if (require.main === module) {
  const built = buildEngineSource();
  const report = runSurvey(loadEngine(built.source), {
    samples: Number(process.argv[2] ?? 1000),
  });
  report.metadata.engineSha256 = built.hash;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[3]) fs.writeFileSync(process.argv[3], json);
  else process.stdout.write(json);
}
module.exports = { runSurvey };
