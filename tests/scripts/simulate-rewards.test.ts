import { expect, it } from "vitest";

const { simulateResources } = require("../../scripts/simulate-rewards.cjs");
const {
  buildEngineSource,
  loadEngine,
} = require("../../scripts/benchmark-locks.cjs");

it("models censoring and fourth-mistake survival with reproducible engine rewards", () => {
  const engine = loadEngine(buildEngineSource().source);
  const report = simulateResources(engine, { samples: 5, cap: 10 });
  expect(report.raw).toEqual(
    simulateResources(engine, { samples: 5, cap: 10 }).raw,
  );
  for (const row of report.rows.filter(
    (r: { mistakes: number }) => r.mistakes === 0,
  )) {
    expect(row.censored).toBe(5);
    expect(row.chests.min).toBe(10);
    expect(row.ore.min).toBe(325);
  }
  const final = report.raw.filter(
    (r: { mistakes: number }) => r.mistakes === 6,
  );
  for (const run of final) expect(run.censored).toBe(false);
  expect(report.rows).toHaveLength(10);
  expect(() => simulateResources(engine, { cap: 0 })).toThrow();
});
