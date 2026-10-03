import { describe, expect, it } from "vitest";

import {
  getDifficultyBand,
  getDifficultyForChest,
} from "@/game/progressDifficulty";

describe("getDifficultyForChest", () => {
  it("never makes later chests easier", () => {
    const early = getDifficultyForChest(0);
    const middle = getDifficultyForChest(8);
    const late = getDifficultyForChest(20);

    expect(middle.tumblerCount).toBeGreaterThanOrEqual(early.tumblerCount);
    expect(late.tumblerCount).toBeGreaterThanOrEqual(middle.tumblerCount);
    expect(middle.dependencyDensity).toBeGreaterThanOrEqual(
      early.dependencyDensity,
    );
    expect(late.dependencyDensity).toBeGreaterThanOrEqual(
      middle.dependencyDensity,
    );
  });

  it("keeps all difficulty axes monotonic across band boundaries", () => {
    let previous = getDifficultyForChest(0);

    for (let index = 1; index <= 250; index += 1) {
      const current = getDifficultyForChest(index);

      for (const key of [
        "tumblerCount",
        "dependencyDensity",
        "guaranteedSolvableMoves",
        "minSolutionLength",
        "maxSolutionLength",
      ] as const) {
        expect(current[key]).toBeGreaterThanOrEqual(previous[key] ?? 0);
      }

      previous = current;
    }
  });

  it("treats negative indices as the first chest", () => {
    expect(getDifficultyForChest(-5)).toEqual(getDifficultyForChest(0));
  });

  it("keeps tumbler counts within the allowed range", () => {
    for (const chestIndex of [0, 4, 10, 18, 30]) {
      const config = getDifficultyForChest(chestIndex);
      expect(config.tumblerCount).toBeGreaterThanOrEqual(3);
      expect(config.tumblerCount).toBeLessThanOrEqual(6);
    }
  });

  it("increases guaranteed solution length over time", () => {
    expect(getDifficultyForChest(0).guaranteedSolvableMoves).toBeLessThan(
      getDifficultyForChest(12).guaranteedSolvableMoves,
    );
    expect(
      getDifficultyForChest(12).guaranteedSolvableMoves,
    ).toBeLessThanOrEqual(getDifficultyForChest(24).guaranteedSolvableMoves);
  });

  it("keeps dependency density in a safe range", () => {
    for (const chestIndex of [0, 8, 16, 24, 40, 1000]) {
      const density = getDifficultyForChest(chestIndex).dependencyDensity;
      expect(density).toBeGreaterThan(0);
      expect(density).toBeLessThanOrEqual(0.88);
    }
  });

  it("continues increasing scramble and measured solution targets past master", () => {
    const master = getDifficultyForChest(30);
    const later = getDifficultyForChest(100);
    const endless = getDifficultyForChest(1000);

    expect(getDifficultyBand(30)).toBe(4);
    expect(getDifficultyBand(1000)).toBe(4);
    expect(later.guaranteedSolvableMoves).toBeGreaterThan(
      master.guaranteedSolvableMoves,
    );
    expect(endless.guaranteedSolvableMoves).toBeGreaterThan(
      later.guaranteedSolvableMoves,
    );
    expect(endless.minSolutionLength).toBeGreaterThan(
      later.minSolutionLength ?? 0,
    );
    expect(endless.maxSolutionLength).toBeGreaterThan(
      later.maxSolutionLength ?? 0,
    );
  });

  it("starts with a measured solution target of two to four moves", () => {
    expect(getDifficultyForChest(0)).toMatchObject({
      minSolutionLength: 2,
      maxSolutionLength: 4,
    });
  });

  it("adds tumblers at the expected display chest thresholds", () => {
    for (const [index, count] of [
      [3, 3],
      [4, 4],
      [9, 4],
      [10, 5],
      [17, 5],
      [18, 6],
    ]) {
      expect(getDifficultyForChest(index).tumblerCount).toBe(count);
    }
  });
});
