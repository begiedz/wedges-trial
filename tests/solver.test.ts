import { describe, expect, it } from "vitest";

import { applyMoveToLock } from "@/game/applyMove";
import { checkSolved } from "@/game/checkSolved";
import { solveLock } from "@/game/solver";
import type { LockState, MoveRule, PinEffect } from "@/game/types";

function createLock(positions: number[], targets: number[]): LockState {
  return {
    pins: positions.map((position, id) => ({
      id,
      position,
      target: targets[id],
      min: 0,
      max: 2,
    })),
    rules: positions.map((_, sourcePinId) => ({
      sourcePinId,
      direction: 1,
      effects: [{ pinId: sourcePinId, delta: 1 }],
    })),
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 3,
    isSolved: false,
    isFailed: false,
  };
}

function shortestDistance(lock: LockState): number | null {
  const queue = [{ positions: lock.pins.map((pin) => pin.position), depth: 0 }];
  const visited = new Set([queue[0].positions.join(",")]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { positions, depth } = queue[cursor];
    if (
      positions.every((position, index) => position === lock.pins[index].target)
    ) {
      return depth;
    }

    for (const rule of lock.rules) {
      if (
        rule.effects.some(
          (effect) => !lock.pins.some((pin) => pin.id === effect.pinId),
        )
      ) {
        continue;
      }
      const next = lock.pins.map(
        (pin, index) =>
          positions[index] +
          rule.effects
            .filter((effect) => effect.pinId === pin.id)
            .reduce((sum, effect) => sum + effect.delta, 0),
      );
      if (
        next.some(
          (position, index) =>
            position < lock.pins[index].min || position > lock.pins[index].max,
        )
      ) {
        continue;
      }
      const key = next.join(",");
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ positions: next, depth: depth + 1 });
      }
    }
  }
  return null;
}

function createSeededLock(
  seed: number,
  pinCount: number,
  inverseRules: boolean,
): LockState {
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions = Array.from({ length: pinCount }, () =>
    Math.floor(random() * 3),
  );
  const targets = Array.from({ length: pinCount }, () =>
    Math.floor(random() * 3),
  );
  const lock = createLock(positions, targets);
  const rules: MoveRule[] = [];
  for (let sourcePinId = 0; sourcePinId < pinCount; sourcePinId += 1) {
    const effects: PinEffect[] = [{ pinId: sourcePinId, delta: 1 }];
    for (let pinId = 0; pinId < pinCount; pinId += 1) {
      if (pinId !== sourcePinId && random() < 0.5) {
        effects.push({ pinId, delta: random() < 0.5 ? -1 : 1 });
      }
    }
    rules.push({ sourcePinId, direction: 1, effects });
    if (inverseRules) {
      rules.push({
        sourcePinId,
        direction: -1,
        effects: effects.map((effect) => ({
          pinId: effect.pinId,
          delta: effect.delta === 1 ? -1 : 1,
        })),
      });
    }
  }
  return { ...lock, rules };
}

function expectShortestValidSolution(lock: LockState): void {
  const path = solveLock(lock);
  const expectedDistance = shortestDistance(lock);

  if (expectedDistance === null) {
    expect(path).toBeNull();
    return;
  }
  expect(path).not.toBeNull();
  expect(path).toHaveLength(expectedDistance);
  let current = lock;
  for (const move of path ?? []) {
    const result = applyMoveToLock(current, move.pinId, move.direction);
    expect(result.kind).toBe("valid");
    current = result.lock;
  }
  expect(checkSolved(current)).toBe(true);
}

describe("solveLock", () => {
  it.each([false, true])(
    "matches reference BFS on seeded small locks with inverse rules: %s",
    (inverseRules) => {
      for (const pinCount of [2, 3]) {
        for (let seed = 1; seed <= 60; seed += 1) {
          expectShortestValidSolution(
            createSeededLock(seed, pinCount, inverseRules),
          );
        }
      }
    },
  );

  it("uses pin ids independently of array indices", () => {
    const lock = createLock([0, 0], [2, 1]);
    lock.pins[0].id = 37;
    lock.pins[1].id = 10;
    lock.rules = [
      { sourcePinId: 10, direction: 1, effects: [{ pinId: 10, delta: 1 }] },
      { sourcePinId: 37, direction: 1, effects: [{ pinId: 37, delta: 1 }] },
    ];

    expectShortestValidSolution(lock);
    expect(solveLock(lock)).toHaveLength(3);
  });

  it("returns an empty path for a lock already at target", () => {
    expect(solveLock(createLock([1, 2], [1, 2]), 0)).toEqual([]);
  });

  it("returns null when directed rules cannot reach the target", () => {
    expect(solveLock(createLock([2, 2], [0, 0]))).toBeNull();
  });

  it("returns null when the search budget cannot explore a solution", () => {
    const lock = createLock([0, 0], [2, 2]);

    expect(solveLock(lock, 1)).toBeNull();
    expect(solveLock(lock, 2)).toBeNull();
    expect(solveLock(lock, 100)).toHaveLength(4);
  });

  it("ignores rules referring to unknown effect ids", () => {
    const lock = createLock([0], [2]);
    const unknownRule: MoveRule = {
      sourcePinId: 0,
      direction: -1,
      effects: [{ pinId: 99, delta: -1 }],
    };
    lock.rules.unshift(unknownRule);

    expectShortestValidSolution(lock);
    expect(solveLock({ ...lock, rules: [unknownRule] })).toBeNull();
  });
});
