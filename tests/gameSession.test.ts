// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameSession } from "@/components/game/useGameSession";
import { createRun, openSolvedChest } from "@/game/createRun";
import { clearRunState, loadRunState, saveRunState } from "@/game/persistence";
import { getChestReward } from "@/game/rewards";
import type { RunState } from "@/game/types";

vi.mock("@/game/createRun", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/game/createRun")>();
  return {
    ...original,
    createRun: vi.fn(),
    openSolvedChest: vi.fn(original.openSolvedChest),
  };
});

vi.mock("@/game/rewards", () => ({ getChestReward: vi.fn() }));
vi.mock("@/game/persistence", () => ({
  loadRunState: vi.fn(),
  saveRunState: vi.fn(),
  clearRunState: vi.fn(),
}));

function fixture(): RunState {
  return {
    chestIndex: 4,
    oreNuggets: 30,
    lockpicks: 1,
    currentLock: {
      pins: [{ id: 0, position: 1, target: 2, min: 0, max: 2 }],
      rules: [
        { sourcePinId: 0, direction: 1, effects: [{ pinId: 0, delta: 1 }] },
        { sourcePinId: 0, direction: -1, effects: [{ pinId: 0, delta: -1 }] },
      ],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
      isSolved: false,
      isFailed: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createRun).mockImplementation(fixture);
  vi.mocked(loadRunState).mockReturnValue(null);
  vi.mocked(saveRunState).mockReturnValue(true);
  vi.mocked(clearRunState).mockReturnValue(true);
  vi.mocked(getChestReward).mockReturnValue({ oreNuggets: 12, lockpicks: 1 });
});

afterEach(cleanup);

describe("game session reward flow", () => {
  it("reveals one stable reward on solving and ignores repeated moves", () => {
    const { result } = renderHook(useGameSession);

    act(() => result.current.move(0, 1));

    expect(result.current.run?.currentLock.isSolved).toBe(true);
    expect(result.current.reward).toEqual({ oreNuggets: 12, lockpicks: 1 });
    expect(result.current.rewardOpen).toBe(true);

    act(() => {
      result.current.move(0, 1);
      result.current.move(0, -1);
    });

    expect(getChestReward).toHaveBeenCalledTimes(1);
    expect(result.current.reward).toEqual({ oreNuggets: 12, lockpicks: 1 });
  });

  it("claims and advances exactly once even with two clicks in one render", () => {
    const { result } = renderHook(useGameSession);
    act(() => result.current.move(0, 1));

    act(() => {
      result.current.continueToNextChest();
      result.current.continueToNextChest();
    });

    expect(result.current.run?.chestIndex).toBe(5);
    expect(result.current.run?.oreNuggets).toBe(42);
    expect(result.current.run?.lockpicks).toBe(2);
    expect(result.current.reward).toBeNull();
    expect(result.current.rewardOpen).toBe(false);
    expect(openSolvedChest).toHaveBeenCalledTimes(1);
    expect(saveRunState).toHaveBeenCalledTimes(1);
  });

  it("can dismiss and reopen reward feedback without rerolling or advancing", () => {
    const { result } = renderHook(useGameSession);
    act(() => result.current.move(0, 1));
    const reward = result.current.reward;

    act(() => result.current.setRewardOpen(false));
    expect(result.current.run?.chestIndex).toBe(4);
    act(() => result.current.setRewardOpen(true));

    expect(result.current.reward).toEqual(reward);
    expect(getChestReward).toHaveBeenCalledTimes(1);
    expect(saveRunState).not.toHaveBeenCalled();
  });

  it("cannot reset a solved chest to obtain another reward", () => {
    const { result } = renderHook(useGameSession);
    act(() => result.current.move(0, 1));
    act(() => result.current.resetLock());

    expect(result.current.run?.currentLock.isSolved).toBe(true);
    expect(getChestReward).toHaveBeenCalledTimes(1);
  });
});

describe("game session failure and restart", () => {
  it("blocks play and reset after the last pick breaks without resetting pins", () => {
    const run = fixture();
    run.currentLock.pins[0].position = 0;
    run.currentLock.invalidMovesOnCurrentPick = 2;
    vi.mocked(createRun).mockReturnValue(run);
    const { result } = renderHook(useGameSession);

    act(() => result.current.move(0, -1));
    const failedRun = result.current.run;
    expect(failedRun?.lockpicks).toBe(0);
    expect(failedRun?.currentLock.isFailed).toBe(true);
    expect(failedRun?.currentLock.pins[0].position).toBe(0);
    expect(failedRun?.oreNuggets).toBe(30);

    act(() => {
      result.current.move(0, 1);
      result.current.resetLock();
      result.current.continueToNextChest();
    });

    expect(result.current.run).toEqual(failedRun);
    expect(getChestReward).not.toHaveBeenCalled();
    expect(openSolvedChest).not.toHaveBeenCalled();
  });

  it("cancels a restart without changing the active run", () => {
    const { result } = renderHook(useGameSession);
    const originalRun = result.current.run;

    act(() => result.current.requestNewRun());
    expect(result.current.restartOpen).toBe(true);
    act(() => result.current.setRestartOpen(false));

    expect(result.current.run).toEqual(originalRun);
    expect(createRun).toHaveBeenCalledTimes(1);
  });

  it("starts over only after confirmation and removes the abandoned save", () => {
    const { result } = renderHook(useGameSession);
    act(() => result.current.requestNewRun());
    const freshRun = { ...fixture(), chestIndex: 1, oreNuggets: 0 };
    vi.mocked(createRun).mockReturnValue(freshRun);

    act(() => result.current.startNewRun());

    expect(result.current.run).toEqual(freshRun);
    expect(result.current.restartOpen).toBe(false);
    expect(result.current.reward).toBeNull();
    expect(clearRunState).toHaveBeenCalledTimes(1);
  });
});
