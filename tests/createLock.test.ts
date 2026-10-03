import { describe, expect, it, vi } from "vitest";
import { applyMoveToLock } from "@/game/applyMove";
import { checkSolved } from "@/game/checkSolved";
import { createLock } from "@/game/createLock";
import { getDifficultyForChest } from "@/game/progressDifficulty";
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

function createSeededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("createLock", () => {
  const config: DifficultyConfig = {
    tumblerCount: 4,
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

  it.each([0, 3, 4, 9, 10, 17, 18, 24, 49])(
    "measures and targets shortest solutions at difficulty index %i",
    (index) => {
      const difficulty = getDifficultyForChest(index);
      for (const seed of [1, 7, 42]) {
        let lock = createLock(difficulty, createSeededRandom(seed));
        const solution = solveLock(lock);
        expect(solution).not.toBeNull();
        expect(solution?.length).toBeGreaterThanOrEqual(
          difficulty.minSolutionLength ?? 1,
        );
        expect(solution?.length).toBeLessThanOrEqual(
          difficulty.maxSolutionLength ?? difficulty.guaranteedSolvableMoves,
        );
        for (const move of solution ?? []) {
          const result = applyMoveToLock(lock, move.pinId, move.direction);
          expect(result.kind).toBe("valid");
          lock = result.lock;
        }
        expect(checkSolved(lock)).toBe(true);
      }
    },
  );

  it("is reproducible with the same random seed", () => {
    const difficulty = getDifficultyForChest(24);
    expect(createLock(difficulty, createSeededRandom(42))).toEqual(
      createLock(difficulty, createSeededRandom(42)),
    );
  });

  it("keeps a solvable bounded fallback when the solver exhausts its budget", async () => {
    const solver = await import("@/game/solver");
    const search = vi.spyOn(solver, "solveLock").mockReturnValue(null);
    const difficulty = getDifficultyForChest(49);
    let lock: ReturnType<typeof createLock>;
    try {
      lock = createLock(difficulty, createSeededRandom(42));
      expect(search).toHaveBeenCalledTimes(12);
    } finally {
      search.mockRestore();
    }
    const solution = solveLock(lock);
    expect(checkSolved(lock)).toBe(false);
    expect(solution).not.toBeNull();
    expect(solution?.length).toBeLessThanOrEqual(
      difficulty.maxSolutionLength ?? 0,
    );
  });

  it("bounds retries when the desired minimum is unreachable", () => {
    let calls = 0;
    const lock = createLock(
      {
        ...config,
        tumblerCount: 1,
        minSolutionLength: 50,
        maxSolutionLength: 60,
      },
      () => {
        calls += 1;
        return 0;
      },
    );
    expect(calls).toBeLessThanOrEqual(100);
    expect(checkSolved(lock)).toBe(false);
    expect(solveLock(lock)?.length).toBe(3);
    expect(lock.maxInvalidMovesPerPick).toBe(3);
  });

  it("rejects a configuration that cannot produce an unsolved lock", () => {
    expect(() =>
      createLock({ ...config, minPosition: 3, maxPosition: 3 }),
    ).toThrow(RangeError);
  });
});
