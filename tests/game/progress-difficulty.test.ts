import { describe, expect, it } from "vitest";

import {
  getDifficultyBand,
  getDifficultyForChest,
} from "@/game/progress-difficulty";

describe("getDifficultyForChest", () => {
  it("never makes later chests easier", () => {
    const early = getDifficultyForChest(0);
    const middle = getDifficultyForChest(8);
    const late = getDifficultyForChest(20);

    expect(middle.plateCount).toBeGreaterThanOrEqual(early.plateCount);
    expect(late.plateCount).toBeGreaterThanOrEqual(middle.plateCount);
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
        "plateCount",
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

  it("keeps plate counts within the allowed range", () => {
    for (const chestIndex of [0, 4, 10, 18, 30]) {
      const config = getDifficultyForChest(chestIndex);
      expect(config.plateCount).toBeGreaterThanOrEqual(4);
      expect(config.plateCount).toBeLessThanOrEqual(7);
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

  it("adds plates at the expected display chest thresholds", () => {
    for (const [index, count] of [
      [0, 4],
      [4, 4],
      [5, 5],
      [11, 5],
      [12, 6],
      [23, 6],
      [24, 7],
      [99, 7],
      [999, 7],
      [9999, 7],
    ]) {
      expect(getDifficultyForChest(index).plateCount).toBe(count);
      expect(getDifficultyBand(index)).toBe(count - 3);
    }
  });
});
