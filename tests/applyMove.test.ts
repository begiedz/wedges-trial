import { describe, expect, it } from "vitest";

import { applyMove } from "@/game/applyMove";
import type { LockState, RunState } from "@/game/types";

function createTestRun(overrides?: Partial<RunState>): RunState {
  const currentLock: LockState = {
    pins: [
      { id: 0, position: 1, target: 2, min: 0, max: 2 },
      { id: 1, position: 1, target: 0, min: 0, max: 2 },
    ],
    rules: [
      {
        sourcePinId: 0,
        direction: 1,
        effects: [
          { pinId: 0, delta: 1 },
          { pinId: 1, delta: -1 },
        ],
      },
      {
        sourcePinId: 0,
        direction: -1,
        effects: [
          { pinId: 0, delta: -1 },
          { pinId: 1, delta: 1 },
        ],
      },
      {
        sourcePinId: 1,
        direction: 1,
        effects: [{ pinId: 1, delta: 1 }],
      },
      {
        sourcePinId: 1,
        direction: -1,
        effects: [{ pinId: 1, delta: -1 }],
      },
    ],
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: 3,
    isSolved: false,
    isFailed: false,
  };

  return {
    chestIndex: 0,
    oreNuggets: 0,
    lockpicks: 2,
    currentLock,
    ...overrides,
  };
}

describe("applyMove", () => {
  it("updates affected pins on a valid move", () => {
    const result = applyMove(createTestRun(), 0, 1);

    expect(result.currentLock.pins.map((pin) => pin.position)).toEqual([2, 0]);
  });

  it("marks the lock solved when every pin reaches target", () => {
    const result = applyMove(createTestRun(), 0, 1);

    expect(result.currentLock.isSolved).toBe(true);
  });

  it("does not move pins on an invalid move", () => {
    const run = createTestRun({
      currentLock: {
        ...createTestRun().currentLock,
        pins: [
          { id: 0, position: 2, target: 2, min: 0, max: 2 },
          { id: 1, position: 1, target: 0, min: 0, max: 2 },
        ],
      },
    });

    const result = applyMove(run, 0, 1);

    expect(result.currentLock.pins.map((pin) => pin.position)).toEqual([2, 1]);
  });

  it("increments invalid move damage on invalid moves", () => {
    const run = createTestRun({
      currentLock: {
        ...createTestRun().currentLock,
        pins: [
          { id: 0, position: 2, target: 2, min: 0, max: 2 },
          { id: 1, position: 1, target: 0, min: 0, max: 2 },
        ],
      },
    });

    const result = applyMove(run, 0, 1);

    expect(result.currentLock.invalidMovesOnCurrentPick).toBe(1);
    expect(result.lockpicks).toBe(2);
  });

  it("breaks a lockpick after exactly three invalid moves", () => {
    let run = createTestRun({
      currentLock: {
        ...createTestRun().currentLock,
        pins: [
          { id: 0, position: 2, target: 2, min: 0, max: 2 },
          { id: 1, position: 1, target: 0, min: 0, max: 2 },
        ],
      },
    });

    run = applyMove(run, 0, 1);
    run = applyMove(run, 0, 1);
    run = applyMove(run, 0, 1);

    expect(run.lockpicks).toBe(1);
    expect(run.currentLock.invalidMovesOnCurrentPick).toBe(0);
    expect(run.currentLock.pins.map((pin) => pin.position)).toEqual([2, 1]);
  });

  it("ignores moves after the lock is solved", () => {
    const solvedRun = createTestRun({
      currentLock: {
        ...createTestRun().currentLock,
        isSolved: true,
      },
    });

    expect(applyMove(solvedRun, 1, -1)).toEqual(solvedRun);
  });

  it("ignores moves after the run has failed", () => {
    const failedRun = createTestRun({
      lockpicks: 0,
      currentLock: {
        ...createTestRun().currentLock,
        isFailed: true,
      },
    });

    expect(applyMove(failedRun, 1, -1)).toEqual(failedRun);
  });
});
