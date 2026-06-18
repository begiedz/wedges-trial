import { describe, expect, it } from "vitest";

import { loadRunState, saveRunState } from "@/game/persistence";
import type { RunState } from "@/game/types";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function createRunState(): RunState {
  return {
    chestIndex: 2,
    oreNuggets: 18,
    lockpicks: 4,
    currentLock: {
      pins: [{ id: 0, position: 1, target: 3, min: 0, max: 6 }],
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
      invalidMovesOnCurrentPick: 1,
      maxInvalidMovesPerPick: 3,
      isSolved: false,
      isFailed: false,
    },
  };
}

describe("persistence", () => {
  it("saves and restores run state", () => {
    const storage = createMemoryStorage();
    const run = createRunState();

    expect(saveRunState(run, storage)).toBe(true);
    expect(loadRunState(storage)).toEqual(run);
  });

  it("rejects invalid saved data safely", () => {
    const storage = createMemoryStorage();
    storage.setItem("wedges-trial.run-state", JSON.stringify({ bad: true }));

    expect(loadRunState(storage)).toBeNull();
  });

  it("returns null when saved data is missing", () => {
    const storage = createMemoryStorage();

    expect(loadRunState(storage)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const storage = createMemoryStorage();
    storage.setItem("wedges-trial.run-state", "{oops");

    expect(loadRunState(storage)).toBeNull();
  });
});
