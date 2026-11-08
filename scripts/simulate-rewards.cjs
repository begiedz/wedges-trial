const fs = require("node:fs");
const {
  buildEngineSource,
  loadEngine,
  seededRandom,
  summarize,
} = require("./benchmark-locks.cjs");

// Resource-only model: each surviving chest is solved/continued; cap survivors
// are censored. Use engine rewards and durability, without modeling human skill.
function simulateResources(
  engine,
  {
    samples = 10000,
    cap = 1000,
    seed = 47,
    rulesetVersion = engine.RULESET_VERSION,
  } = {},
) {
  if (
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 10000 ||
    !Number.isInteger(cap) ||
    cap < 1 ||
    cap > 1000 ||
    !Number.isInteger(seed)
  )
    throw new RangeError("Invalid simulation configuration");
  // Isolate structural sampling from pick RNG so supply scenarios remain paired.
  const tiers = Array.from({ length: cap }, (_, index) => {
    const random = seededRandom(seed + index);
    const config = engine.getLearningProgression(index, random);
    return engine.analyzeConnections(engine.generateRules(config, random)).tier;
  });
  const rows = [];
  const raw = [];
  for (const durability of [3, engine.MAX_INVALID_MOVES_PER_PICK]) {
    for (const mistakes of [0, 1, 2, 3, 6]) {
      const runs = [];
      for (let sample = 0; sample < samples; sample++) {
        const sampleSeed = (seed + sample) >>> 0;
        const random = seededRandom(sampleSeed);
        let picks = engine.STARTING_LOCKPICKS,
          damage = 0,
          chests = 0,
          ore = 0;
        for (let chest = 1; chest <= cap; chest++) {
          for (let mistake = 0; mistake < mistakes; mistake++) {
            damage++;
            if (damage === durability) {
              picks--;
              damage = 0;
            }
            if (picks === 0) break;
          }
          if (picks === 0) break;
          chests++;
          ore += engine.usesDifficultyOre(rulesetVersion)
            ? engine.getDifficultyOre(tiers[chest - 1], mistakes)
            : engine.getDeterministicOre(chest, mistakes);
          picks += engine.getLockpickReward(random, rulesetVersion);
        }
        const run = {
          durability,
          mistakes,
          sample,
          seed: sampleSeed,
          chests,
          ore,
          censored: chests === cap,
        };
        runs.push(run);
        raw.push(run);
      }
      rows.push({
        durability,
        mistakes,
        chests: summarize(runs.map((r) => r.chests)),
        ore: summarize(runs.map((r) => r.ore)),
        censored: runs.filter((r) => r.censored).length,
      });
    }
  }
  return {
    metadata: {
      date: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      samples,
      cap,
      seed,
      ruleset: rulesetVersion,
    },
    rows,
    raw,
  };
}
if (require.main === module) {
  const built = buildEngineSource();
  const report = simulateResources(loadEngine(built.source));
  report.metadata.engineSha256 = built.hash;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[2]) fs.writeFileSync(process.argv[2], json);
  else process.stdout.write(json);
}
module.exports = { simulateResources };
