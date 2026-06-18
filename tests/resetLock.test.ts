import { describe, expect, it } from "vitest";

import { resetCurrentLock } from "@/game/resetLock";
import type { LockState, RunState } from "@/game/types";

function createTestRun(overrides?: Partial<RunState>): RunState {
  const currentLock: LockState = {
    pins: [
      { id: 0, position: 1, target: 3, min: 0, max: 6 },
      { id: 1, position: 4, target: 3, min: 0, max: 6 },
    ],
    rules: [
      {
        sourcePinId: 0,
        direction: 1,
        effects: [{ pinId: 0, delta: 1 }],
      },
      {
        sourcePinId: 0,
        direction: -1,
        effects: [{ pinId: 0, delta: -1 }],
      },
    ],
    invalidMovesOnCurrentPick: 2,
    maxInvalidMovesPerPick: 3,
    isSolved: false,
    isFailed: false,
  };

  return {
    chestIndex: 2,
    oreNuggets: 17,
    lockpicks: 2,
    currentLock,
    ...overrides,
  };
}

describe("resetCurrentLock", () => {
  it("restores the initial lock state without changing run totals", () => {
    const initialLock: LockState = {
      ...createTestRun().currentLock,
      pins: [
        { id: 0, position: 3, target: 3, min: 0, max: 6 },
        { id: 1, position: 3, target: 3, min: 0, max: 6 },
      ],
      invalidMovesOnCurrentPick: 0,
      isSolved: false,
    };
    const run = createTestRun();

    const result = resetCurrentLock(run, initialLock);

    expect(result.chestIndex).toBe(run.chestIndex);
    expect(result.oreNuggets).toBe(run.oreNuggets);
    expect(result.lockpicks).toBe(run.lockpicks);
    expect(result.currentLock.pins).toEqual(initialLock.pins);
    expect(result.currentLock.invalidMovesOnCurrentPick).toBe(0);
  });

  it("ignores reset after the run has failed", () => {
    const run = createTestRun({
      lockpicks: 0,
      currentLock: {
        ...createTestRun().currentLock,
        isFailed: true,
      },
    });

    expect(resetCurrentLock(run, createTestRun().currentLock)).toEqual(run);
  });
});
