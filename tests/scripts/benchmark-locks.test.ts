import { describe, expect, it } from "vitest";

const {
  buildEngineSource,
  loadEngine,
  runBenchmark,
  summarize,
} = require("../../scripts/benchmark-locks.cjs");

describe("lock benchmark", () => {
  it("uses nearest-rank percentiles without reordering raw samples", () => {
    const values = [100, 1, 3, 2];
    expect(summarize(values)).toMatchObject({
      count: 4,
      p50: 2,
      p95: 100,
      min: 1,
      max: 100,
      mean: 26.5,
    });
    expect(values).toEqual([100, 1, 3, 2]);
    expect(() => summarize([])).toThrow();
  });

  it("replays real solutions and measures continuation at the destination chest", () => {
    const built = buildEngineSource();
    const engine = loadEngine(built.source);
    const report = runBenchmark(engine, {
      rulesetVersion: engine.SCARCE_PICKS_RULESET_VERSION,
      samples: 2,
      warmups: 1,
      chests: [1, 25, 10000],
    });
    expect(built.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      report.rows.map(
        (row: { config: { plateCount: number } }) => row.config.plateCount,
      ),
    ).toEqual([4, 7, 7]);
    expect(report.raw).toHaveLength(16);
    for (const row of report.rows) {
      expect(row.solverNulls).toBe(0);
      expect(row.operations.createLock.count).toBe(2);
      expect(row.operations.solveLock.count).toBe(2);
      if (row.chest === 1)
        expect(row.operations.openSolvedChest).toBeUndefined();
      else expect(row.operations.openSolvedChest.count).toBe(2);
    }
    expect(() => runBenchmark(engine, { samples: 0 })).toThrow();
  });
});
