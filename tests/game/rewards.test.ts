import { describe, expect, it } from "vitest";
import { getDeterministicOre, getLockpickReward } from "@/game/rewards";
import { LEGACY_RULESET_VERSION } from "@/game/ruleset";

describe("deterministic-ore-v1 rewards", () => {
  it.each([
    [1, 0, 10],
    [1, 1, 9],
    [1, 2, 8],
    [1, 3, 7],
    [1, 4, 6],
    [1, 6, 4],
    [1, 100, 4],
    [2, 1, 13],
    [10, 2, 44],
    [1000, 6, 2002],
    [10000, 0, 50005],
  ])("chest %i with %i mistakes gives %i ore", (chest, mistakes, expected) => {
    expect(getDeterministicOre(chest, mistakes)).toBe(expected);
  });
  it("is monotonic through early and very late chests", () => {
    for (const chest of [1, 2, 5, 10, 100, 1000, 10000, 100000]) {
      expect(getDeterministicOre(chest + 1, 0)).toBeGreaterThan(
        getDeterministicOre(chest, 0),
      );
      for (let mistakes = 0; mistakes < 30; mistakes++) {
        expect(getDeterministicOre(chest, mistakes + 1)).toBeLessThanOrEqual(
          getDeterministicOre(chest, mistakes),
        );
        expect(getDeterministicOre(chest, mistakes)).toBeGreaterThanOrEqual(
          Math.floor((getDeterministicOre(chest, 0) * 4) / 10),
        );
      }
    }
  });
  it.each([
    [0, 0],
    [0.79, 0],
    [0.79001, 1],
    [0.96, 1],
    [0.96001, 2],
    [0.99999, 2],
  ])("uses the halved drop boundary %f -> %i", (roll, expected) => {
    expect(getLockpickReward(() => roll)).toBe(expected);
  });
});

it("halves each nonzero drop probability", () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 100; i++)
    counts[getLockpickReward(() => (i + 0.5) / 100)]++;
  expect(counts).toEqual([79, 17, 4]);
});
it("preserves original drops for saved runs", () => {
  for (const [roll, expected] of [
    [0.58, 0],
    [0.58001, 1],
    [0.92, 1],
    [0.92001, 2],
  ])
    expect(getLockpickReward(() => roll, LEGACY_RULESET_VERSION)).toBe(
      expected,
    );
});
