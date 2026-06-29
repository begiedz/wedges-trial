"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { textLockCopy } from "@/app/textLockCopy";
import LockEmpty from "@/assets/images/T_LockDifficulty_Empty.png";
import Separator from "@/assets/images/T_TitleLine_Small.png";
import Lock from "@/components/lock";
import { applyMove } from "@/game/applyMove";
import { createRun, openSolvedChest } from "@/game/createRun";
import { loadRunState, saveRunState } from "@/game/persistence";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import type { Direction, LockState, RunState } from "@/game/types";

function getNextPinId(
  run: RunState,
  selectedPinId: number | null,
  offset: number,
): number | null {
  if (run.currentLock.pins.length === 0) {
    return null;
  }

  const currentIndex = run.currentLock.pins.findIndex(
    (pin) => pin.id === selectedPinId,
  );
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    (safeIndex + offset + run.currentLock.pins.length) %
    run.currentLock.pins.length;

  return run.currentLock.pins[nextIndex]?.id ?? null;
}

export default function Game() {
  const [run, setRun] = useState<RunState | null>(null);
  const [initialLock, setInitialLock] = useState<LockState | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);

  useEffect(() => {
    const savedRun = loadRunState();
    const nextRun = savedRun ?? createRun();

    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!run) {
      return;
    }

    const selectedPinExists = run.currentLock.pins.some(
      (pin) => pin.id === selectedPinId,
    );

    if (!selectedPinExists) {
      setSelectedPinId(run.currentLock.pins[0]?.id ?? null);
    }
  }, [run, selectedPinId]);

  const moveSelectedPin = useCallback(
    (direction: Direction) => {
      if (!run || selectedPinId === null) {
        return;
      }

      setRun(applyMove(run, selectedPinId, direction));
    },
    [run, selectedPinId],
  );

  const resetLock = useCallback(() => {
    if (!run || !initialLock) {
      return;
    }

    setRun(resetCurrentLock(run, initialLock));
  }, [initialLock, run]);

  const continueToNextChest = useCallback(() => {
    if (!run || !run.currentLock.isSolved) {
      return;
    }

    const nextRun = openSolvedChest(run);

    saveRunState(nextRun);
    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
  }, [run]);

  const startNewRun = useCallback(() => {
    const nextRun = createRun();

    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!run) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "a" || key === "arrowleft") {
        event.preventDefault();
        moveSelectedPin(1);
        return;
      }

      if (key === "d" || key === "arrowright") {
        event.preventDefault();
        moveSelectedPin(-1);
        return;
      }

      if (key === "w" || key === "arrowup") {
        event.preventDefault();
        setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, -1));
        return;
      }

      if (key === "s" || key === "arrowdown") {
        event.preventDefault();
        setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, 1));
        return;
      }

      if (key === "r") {
        event.preventDefault();
        resetLock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveSelectedPin, resetLock, run]);

  if (!run) {
    return null;
  }

  const selectedPin = run.currentLock.pins.find(
    (pin) => pin.id === selectedPinId,
  );

  return (
    <main className="flex flex-col items-center gap-6">
      <section className="flex flex-col items-center pt-8">
        <h2 className="font-heading text-6xl">Open Chest</h2>
        <div
          className="bg-foreground w-[388px] h-[36px]"
          style={{
            WebkitMaskImage: `url(${Separator.src})`,
            maskImage: `url(${Separator.src})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      </section>
      <div className="flex gap-1">
        <span className="font-medium text-secondary text-lg tracking-wide">
          Difficulty:
        </span>
        <div className="flex justify-center items-center">
          <Image src={LockEmpty.src} alt="" width={24} height={24} />
          <Image src={LockEmpty.src} alt="" width={24} height={24} />
          <Image src={LockEmpty.src} alt="" width={24} height={24} />
          <Image src={LockEmpty.src} alt="" width={24} height={24} />
        </div>
      </div>
      <section className="bg-[#211F21] px-5 py-4 border border-[#6d6a68] rounded-sm">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="bg-[#292729] px-3 py-2 border border-[#6d6a68] rounded-sm">
              {textLockCopy.labels.oreNuggets}: {run.oreNuggets}
            </div>
            <div className="bg-[#292729] px-3 py-2 border border-[#6d6a68] rounded-sm">
              {textLockCopy.labels.lockpicks}: {run.lockpicks}
            </div>
            <div className="bg-[#292729] px-3 py-2 border border-[#6d6a68] rounded-sm">
              {textLockCopy.labels.invalidMoves}:{" "}
              {run.currentLock.invalidMovesOnCurrentPick}/
              {run.currentLock.maxInvalidMovesPerPick}
            </div>
          </div>
        </div>
      </section>

      <section className="gap-6 grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="bg-[#211F21] p-5 border border-[#6d6a68] rounded-sm">
          <Lock
            onSelectPin={setSelectedPinId}
            pins={run.currentLock.pins}
            selectedPinId={selectedPinId}
          />
        </div>

        <aside className="flex flex-col gap-4 bg-[#211F21] p-5 border border-[#6d6a68] rounded-sm">
          <div>
            <p className="text-[#a9a9a9] text-xs uppercase tracking-[0.18em]">
              {textLockCopy.labels.selectedPin}
            </p>
            <p className="mt-2 text-lg">
              {selectedPin ? `#${selectedPin.id}` : textLockCopy.labels.noValue}
            </p>
          </div>

          <div className="gap-3 grid grid-cols-2">
            <button
              className="hover:bg-[#94876F] disabled:opacity-50 px-3 py-2 border border-[#94876F] rounded-sm hover:text-background transition disabled:cursor-not-allowed"
              disabled={
                selectedPinId === null ||
                run.currentLock.isFailed ||
                run.currentLock.isSolved
              }
              onClick={() => moveSelectedPin(-1)}
              type="button"
            >
              {textLockCopy.actions.moveLeft}
            </button>
            <button
              className="hover:bg-[#94876F] disabled:opacity-50 px-3 py-2 border border-[#94876F] rounded-sm hover:text-background transition disabled:cursor-not-allowed"
              disabled={
                selectedPinId === null ||
                run.currentLock.isFailed ||
                run.currentLock.isSolved
              }
              onClick={() => moveSelectedPin(1)}
              type="button"
            >
              {textLockCopy.actions.moveRight}
            </button>
          </div>

          <button
            className="hover:bg-[#3b363b] disabled:opacity-50 px-3 py-2 border border-[#6d6a68] rounded-sm transition disabled:cursor-not-allowed"
            disabled={!initialLock || run.currentLock.isFailed}
            onClick={resetLock}
            type="button"
          >
            {textLockCopy.actions.reset}
          </button>

          <button
            className="hover:bg-[#5f7a43] disabled:opacity-50 px-3 py-2 border border-[#8ea56e] rounded-sm hover:text-background transition disabled:cursor-not-allowed"
            disabled={!run.currentLock.isSolved}
            onClick={continueToNextChest}
            type="button"
          >
            {textLockCopy.actions.continueToNextChest}
          </button>

          <button
            className="hover:bg-[#3b363b] px-3 py-2 border border-[#6d6a68] rounded-sm transition"
            onClick={startNewRun}
            type="button"
          >
            {textLockCopy.actions.newRun}
          </button>

          <div className="space-y-2 pt-4 border-[#6d6a68] border-t text-[#c6b8ad] text-sm">
            <p>
              {textLockCopy.labels.state}:{" "}
              {run.currentLock.isFailed
                ? textLockCopy.states.failed
                : run.currentLock.isSolved
                  ? textLockCopy.states.solved
                  : textLockCopy.states.active}
            </p>
            <p>
              {textLockCopy.labels.selectedPin}:{" "}
              {selectedPin
                ? `${textLockCopy.labels.position} ${selectedPin.position}, ${textLockCopy.labels.target} ${selectedPin.target}`
                : textLockCopy.labels.noValue}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
