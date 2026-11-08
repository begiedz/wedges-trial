const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const {
  CHESTS,
  seededRandom,
  mixSeed,
  summarize,
  buildEngineSource,
  loadEngine,
} = require("./benchmark-locks.cjs");

// Same bounded corpus locally and in the private standalone Preview fixture.
function runSurvey(
  engine,
  {
    samples = 1000,
    chests = CHESTS,
    seed = 50,
    rulesetVersion = engine.RULESET_VERSION,
  } = {},
) {
  if (
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 1000 ||
    !Number.isInteger(seed) ||
    !chests.length ||
    chests.some(
      (chest) => !Number.isSafeInteger(chest) || chest < 1 || chest > 100000,
    )
  )
    throw new RangeError("Invalid survey configuration");
  const rows = [];
  const raw = [];
  for (const chest of chests) {
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
      // Mix adjacent input seeds before the LCG so the first configuration draw
      // does not correlate plate counts with nearby sample indices.
      const sampleSeed = mixSeed(seed + chest * 100003 + i);
      const random = seededRandom(sampleSeed);
      const cpu = process.cpuUsage();
      const start = performance.now();
      const config = engine.usesLearningProgression(rulesetVersion)
        ? engine.getLearningProgression(chest - 1, random)
        : engine.getDifficultyForChest(chest - 1);
      const generated = engine.createLockWithDiagnostics(config, random);
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
        config,
        structure: engine.analyzeConnections(lock.rules),
        plateCount: lock.pins.length,
        initialLegalActions: lock.rules.filter(
          (rule) =>
            engine.applyMoveToLock(lock, rule.sourcePinId, rule.direction)
              .kind === "valid",
        ).length,
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
      plateCounts: Object.fromEntries(
        [4, 5, 6, 7].map((count) => [
          count,
          raw.filter((row) => row.chest === chest && row.plateCount === count)
            .length,
        ]),
      ),
      tiers: Object.fromEntries(
        [1, 2, 3, 4].map((tier) => [
          tier,
          raw.filter(
            (row) => row.chest === chest && row.structure.tier === tier,
          ).length,
        ]),
      ),
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
      rulesetVersion,
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
    chests: [...Array.from({ length: 50 }, (_, i) => i + 1), 100, 1000, 10000],
  });
  report.metadata.engineSha256 = built.hash;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[3]) fs.writeFileSync(process.argv[3], json);
  else process.stdout.write(json);
}
module.exports = { runSurvey };
