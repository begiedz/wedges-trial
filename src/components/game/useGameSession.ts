"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyMove } from "@/game/applyMove";
import { createRun, openSolvedChest } from "@/game/createRun";
import { clearRunState, loadRunState, saveRunState } from "@/game/persistence";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import type { ChestReward, Direction, LockState, RunState } from "@/game/types";

export function useGameSession() {
  const [run, setRun] = useState<RunState | null>(null);
  const current = useRef<RunState | null>(null);
  const initialLock = useRef<LockState | null>(null);
  const pendingRun = useRef<RunState | null>(null);
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const updateRun = useCallback((next: RunState) => {
    // Update synchronously so repeated inputs before a render see the latest state.
    current.current = next;
    setRun(next);
  }, []);

  const prepareReward = useCallback((solved: RunState) => {
    const next = openSolvedChest(solved);
    pendingRun.current = next;
    setReward(next.reward);
    setRewardOpen(true);
  }, []);

  useEffect(() => {
    const next = loadRunState() ?? createRun();
    initialLock.current = cloneLockState(next.currentLock);
    updateRun(next);
    if (next.currentLock.isSolved) prepareReward(next);
  }, [prepareReward, updateRun]);

  const move = useCallback(
    (pinId: number, direction: Direction) => {
      const previous = current.current;
      if (!previous) return null;
      const next = applyMove(previous, pinId, direction);
      if (next === previous) return next;
      updateRun(next);
      if (next.currentLock.isSolved) prepareReward(next);
      if (next.currentLock.isFailed) clearRunState();
      return next;
    },
    [prepareReward, updateRun],
  );

  const continueToNextChest = useCallback(() => {
    const next = pendingRun.current;
    if (!next) return;
    // Consume the prepared result before publishing it; retries cannot award twice.
    pendingRun.current = null;
    initialLock.current = cloneLockState(next.currentLock);
    updateRun(next);
    setReward(null);
    setRewardOpen(false);
    saveRunState(next);
  }, [updateRun]);

  const resetLock = useCallback(() => {
    if (
      !current.current ||
      !initialLock.current ||
      current.current.currentLock.isSolved
    )
      return;
    updateRun(resetCurrentLock(current.current, initialLock.current));
  }, [updateRun]);

  const startNewRun = useCallback(() => {
    const next = createRun();
    clearRunState();
    pendingRun.current = null;
    initialLock.current = cloneLockState(next.currentLock);
    setReward(null);
    setRewardOpen(false);
    setRestartOpen(false);
    updateRun(next);
  }, [updateRun]);

  const requestNewRun = useCallback(() => {
    if (current.current?.currentLock.isFailed) {
      startNewRun();
      return;
    }
    setRestartOpen(true);
  }, [startNewRun]);

  return {
    run,
    reward,
    rewardOpen,
    setRewardOpen,
    restartOpen,
    setRestartOpen,
    move,
    continueToNextChest,
    resetLock,
    startNewRun,
    requestNewRun,
  };
}
