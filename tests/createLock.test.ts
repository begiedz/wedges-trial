import { describe, expect, it } from "vitest";

import { checkSolved } from "@/game/checkSolved";
import { createLock } from "@/game/createLock";
import { solveLock } from "@/game/solver";
import type { DifficultyConfig, RandomSource } from "@/game/types";

function createSequenceRandom(values: number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("createLock", () => {
  const config: DifficultyConfig = {
    pinCount: 4,
    minPosition: 0,
    maxPosition: 6,
    targetPosition: 3,
    dependencyDensity: 0.5,
    guaranteedSolvableMoves: 6,
  };

  it("creates the expected number of pins", () => {
    const lock = createLock(config, createSequenceRandom([0.1, 0.8, 0.3, 0.6]));

    expect(lock.pins).toHaveLength(4);
  });

  it("creates pins with valid min, max, and target values", () => {
    const lock = createLock(config, createSequenceRandom([0.1, 0.8, 0.3, 0.6]));

    for (const pin of lock.pins) {
      expect(pin.min).toBe(config.minPosition);
      expect(pin.max).toBe(config.maxPosition);
      expect(pin.target).toBe(config.targetPosition);
      expect(pin.position).toBeGreaterThanOrEqual(pin.min);
      expect(pin.position).toBeLessThanOrEqual(pin.max);
    }
  });

  it("does not start already solved", () => {
    const lock = createLock(config, createSequenceRandom([0.1, 0.8, 0.3, 0.6]));

    expect(checkSolved(lock)).toBe(false);
  });

  it("creates a lock that remains solvable", () => {
    const lock = createLock(config, createSequenceRandom([0.1, 0.8, 0.3, 0.6]));

    expect(solveLock(lock)).not.toBeNull();
  });
});
