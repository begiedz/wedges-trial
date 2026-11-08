const fs = require("node:fs");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const {
  buildEngineSource,
  loadEngine,
  runBenchmark,
} = require("./benchmark-locks.cjs");
const { runSurvey } = require("./survey-locks.cjs");
const { simulateResources } = require("./simulate-rewards.cjs");

/** Sequential matched-environment evidence; never omit outliers or failed gates. */
function runComparison(
  engine,
  outputDirectory,
  { samples = 1000, resourceSamples = 10000, engineSha256 } = {},
) {
  const chests = [
    ...Array.from({ length: 50 }, (_, i) => i + 1),
    100,
    1000,
    10000,
  ];
  fs.mkdirSync(outputDirectory, { recursive: true });
  const write = (name, report) => {
    report.metadata.engineSha256 = engineSha256;
    fs.writeFileSync(
      path.join(outputDirectory, `${name}.gz`),
      gzipSync(JSON.stringify(report)),
    );
  };
  for (const rulesetVersion of [
    engine.SCARCE_PICKS_RULESET_VERSION,
    engine.LEARNING_RULESET_VERSION,
  ]) {
    const survey = runSurvey(engine, {
      samples,
      chests,
      seed: 50,
      rulesetVersion,
    });
    write(`${rulesetVersion}-survey`, survey);
    const timing = runBenchmark(engine, {
      samples: Math.min(100, samples),
      chests: [1, 5, 6, 12, 13, 18, 24, 25, 30, 50, 100, 1000, 10000],
      seed: 28,
      rulesetVersion,
    });
    write(`${rulesetVersion}-timing`, timing);
    process.stdout.write(
      `${rulesetVersion}: ${survey.raw.length} surveyed locks, max generation ${Math.max(...survey.rows.map((row) => row.generationMs.max)).toFixed(2)} ms\n`,
    );
  }
  write(
    "learning-ramp-v1-resources",
    simulateResources(engine, { samples: resourceSamples }),
  );
}
if (require.main === module) {
  if (!process.argv[2])
    throw new Error(
      "Usage: node scripts/benchmark-progression.cjs <output-directory> [samples] [emitted-engine-path] [source-sha256]",
    );
  const emittedPath = process.argv[4];
  const built = emittedPath ? null : buildEngineSource();
  const engine = emittedPath
    ? require(path.resolve(emittedPath))
    : loadEngine(built.source);
  runComparison(engine, process.argv[2], {
    samples: Number(process.argv[3] ?? 1000),
    engineSha256: built?.hash ?? process.argv[5],
  });
}
module.exports = { runComparison };
