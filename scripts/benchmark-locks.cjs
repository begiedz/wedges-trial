const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");

const CHESTS = [1, 5, 6, 12, 13, 24, 25, 100, 1000, 10000];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function mixSeed(seed) {
  let mixed = seed >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
  return (mixed ^ (mixed >>> 15)) >>> 0;
}

function summarize(values) {
  if (!values.length) throw new RangeError("Empty measurement set");
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const percentile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
  return {
    count: values.length,
    min: sorted[0],
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1),
    mean,
    standardDeviation: Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        values.length,
    ),
  };
}

// Transpile before timing. The emitted fixture uses the exact same engine code
// without TypeScript, test instrumentation, mocks, or framework startup costs.
function buildEngineSource() {
  const ts = require("typescript");
  const root = path.resolve(__dirname, "../src/game");
  const hash = crypto.createHash("sha256");
  const factories = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => {
      const source = fs.readFileSync(path.join(root, name), "utf8");
      hash.update(name).update("\0").update(source).update("\0");
      const code = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      return `${JSON.stringify(name.slice(0, -3))}: function(require, module, exports) {\n${code}\n}`;
    });
  const source = `const factories = {${factories.join(",\n")}};
const cache = {};
function load(name) {
  const id = name.replace(/^@\\/game\\//, "").replace(/^\\.\\//, "");
  if (!factories[id]) throw new Error("Unexpected engine dependency: " + name);
  if (!cache[id]) { const module = {exports: {}}; cache[id] = module; factories[id](load, module, module.exports); }
  return cache[id].exports;
}
module.exports = { ...load("create-lock"), ...load("solver"), ...load("create-run"), ...load("progress-difficulty"), ...load("apply-move"), ...load("check-solved"), ...load("rewards"), ...load("constants"), ...load("ruleset"), ...load("learning-progression"), ...load("analyze-connections"), ...load("generate-rules") };`;
  return { source, hash: hash.digest("hex") };
}

function loadEngine(source) {
  const module = { exports: {} };
  new Function("module", source)(module);
  return module.exports;
}

function runBenchmark(
  engine,
  {
    samples = 100,
    warmups = 3,
    chests = CHESTS,
    seed = 28,
    rulesetVersion = engine.RULESET_VERSION,
  } = {},
) {
  if (
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 1000 ||
    !Number.isInteger(warmups) ||
    warmups < 0 ||
    warmups > 20 ||
    !Number.isInteger(seed) ||
    !chests.length ||
    chests.some((n) => !Number.isSafeInteger(n) || n < 1)
  )
    throw new RangeError("Invalid benchmark configuration");
  const rows = [];
  const raw = [];
  const started = performance.now();
  for (const chest of chests) {
    const config = engine.usesLearningProgression(rulesetVersion)
      ? engine.getLearningProgression(chest - 1, seededRandom(seed))
      : engine.getDifficultyForChest(chest - 1);
    const measurements = { createLock: [], solveLock: [], openSolvedChest: [] };
    let unavailableOptimum = 0;
    let solverNulls = 0;
    let belowTarget = 0;
    for (let i = -warmups; i < samples; i++) {
      const sampleSeed = mixSeed(seed + chest * 100003 + i);
      const measure = (operation, fn) => {
        const cpu = process.cpuUsage();
        const start = performance.now();
        const result = fn();
        const ms = performance.now() - start;
        const used = process.cpuUsage(cpu);
        if (i >= 0) {
          measurements[operation].push(ms);
          raw.push({
            chest,
            sample: i,
            seed: sampleSeed,
            operation,
            ms,
            cpuMs: (used.user + used.system) / 1000,
          });
        }
        return result;
      };
      const lock = measure("createLock", () =>
        engine.createChestLock(
          chest - 1,
          seededRandom(sampleSeed),
          rulesetVersion,
        ),
      );
      const solution = measure("solveLock", () => engine.solveLock(lock));
      if (i >= 0) {
        unavailableOptimum += Number(lock.optimalMoves === null);
        solverNulls += Number(solution === null);
        belowTarget += Number(
          solution !== null && solution.length < config.minSolutionLength,
        );
      }
      // Replay outside the timer to verify the measured solution is legal.
      if (solution) {
        let solved = lock;
        for (const move of solution) {
          const result = engine.applyMoveToLock(
            solved,
            move.pinId,
            move.direction,
          );
          if (result.kind !== "valid")
            throw new Error("Illegal benchmark solution");
          solved = result.lock;
        }
        if (!engine.checkSolved(solved))
          throw new Error("Incomplete benchmark solution");
      }
      // Measure generating the same destination difficulty. A legitimate solved
      // predecessor is prepared outside the timer, never by setting isSolved alone.
      if (chest > 1) {
        let previous = engine.createChestLock(
          chest - 2,
          seededRandom(sampleSeed ^ 0xabcdef),
          rulesetVersion,
        );
        const moves = engine.solveLock(previous);
        if (!moves)
          throw new Error(
            "Cannot prepare solved predecessor within solver budget",
          );
        for (const move of moves)
          previous = engine.applyMoveToLock(
            previous,
            move.pinId,
            move.direction,
          ).lock;
        if (!engine.checkSolved(previous))
          throw new Error("Unsolved predecessor");
        const next = measure("openSolvedChest", () =>
          engine.openSolvedChest(
            {
              chestIndex: chest - 1,
              oreNuggets: 0,
              lockpicks: 3,
              currentLock: previous,
            },
            seededRandom(sampleSeed),
            rulesetVersion,
          ),
        );
        if (next.chestIndex !== chest || next.currentLock.isSolved)
          throw new Error("Invalid continuation");
      }
    }
    rows.push({
      chest,
      config,
      unavailableOptimum,
      solverNulls,
      belowTarget,
      operations: Object.fromEntries(
        Object.entries(measurements)
          .filter(([, values]) => values.length)
          .map(([name, values]) => [name, summarize(values)]),
      ),
    });
  }
  return {
    metadata: {
      date: new Date().toISOString(),
      rulesetVersion,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
      samples,
      warmups,
      seed,
      chests,
      totalMs: performance.now() - started,
      maxRssKiB: process.resourceUsage().maxRSS,
      memoryAtEnd: process.memoryUsage(),
    },
    rows,
    raw,
  };
}

if (require.main === module) {
  const built = buildEngineSource();
  const report = runBenchmark(loadEngine(built.source), {
    samples: Number(process.argv[2] ?? 100),
  });
  report.metadata.engineSha256 = built.hash;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[3]) fs.writeFileSync(process.argv[3], json);
  else process.stdout.write(json);
}
module.exports = {
  CHESTS,
  seededRandom,
  mixSeed,
  summarize,
  buildEngineSource,
  loadEngine,
  runBenchmark,
};
