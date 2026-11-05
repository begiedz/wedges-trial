import { describe, expect, it } from "vitest";

const { runSurvey } = require("../../scripts/survey-locks.cjs");
const {
  buildEngineSource,
  loadEngine,
} = require("../../scripts/benchmark-locks.cjs");

describe("lock survey", () => {
  it("records seeded evidence, dependency patterns and bounded generation outcomes without solution paths", () => {
    const engine = loadEngine(buildEngineSource().source);
    const report = runSurvey(engine, { samples: 3, chests: [1, 10000] });
    const repeated = runSurvey(engine, { samples: 3, chests: [1, 10000] });
    expect(report.raw).toHaveLength(6);
    expect(report.raw.map((row: { ruleHash: string }) => row.ruleHash)).toEqual(
      repeated.raw.map((row: { ruleHash: string }) => row.ruleHash),
    );
    for (const row of report.rows) {
      expect(
        Object.values(row.outcomes).reduce((a, b) => Number(a) + Number(b), 0),
      ).toBe(3);
      expect(row.attempts.max).toBeLessThanOrEqual(12);
      expect(row.shortestMismatch).toBe(0);
      expect(row.verifiedLength.count).toBe(3);
    }
    expect(
      report.raw.every(
        (row: object) => !("solution" in row) && !("lock" in row),
      ),
    ).toBe(true);
    for (const config of [
      { samples: 0 },
      { samples: 1001 },
      { chests: [] },
      { chests: [999] },
    ])
      expect(() => runSurvey(engine, config)).toThrow(RangeError);
  });
});
