"use client";

import { useCallback, useEffect, useState } from "react";
import LockPickIcon from "@/assets/images/icons/items/T_ItemIcon_ItKe_Lockpick.png";
import OreNuggetIcon from "@/assets/images/icons/items/T_ItemIcon_ItMi_Orenugget.png";
import Separator from "@/assets/images/T_TitleLine_Small.png";
import { START_NEW_RUN_EVENT } from "@/components/game/events";
import Card from "@/components/general/atoms/card";
import Difficulty from "@/components/general/molecules/difficulty";
import ItemFrame from "@/components/general/molecules/item-frame";
import Movement from "@/components/general/molecules/movement";
import Lock from "@/components/lock";
import { applyMove } from "@/game/applyMove";
import { createRun, openSolvedChest } from "@/game/createRun";
import { loadRunState, saveRunState } from "@/game/persistence";
import { getDifficultyBand } from "@/game/progressDifficulty";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import type { Direction, LockState, RunState } from "@/game/types";
import { useGameDictionary } from "@/i18n/provider";

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

export function GameClient() {
  const t = useGameDictionary();
  const [run, setRun] = useState<RunState | null>(null);
  const [initialLock, setInitialLock] = useState<LockState | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [invalidMove, setInvalidMove] = useState({ pinId: -1, sequence: 0 });

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

      const nextRun = applyMove(run, selectedPinId, direction);

      // Pick damage resets when a pick breaks, but that move still needs feedback.
      if (
        nextRun.currentLock.invalidMovesOnCurrentPick !==
          run.currentLock.invalidMovesOnCurrentPick ||
        nextRun.lockpicks < run.lockpicks
      ) {
        setInvalidMove((previous) => ({
          pinId: selectedPinId,
          sequence: previous.sequence + 1,
        }));
      }

      setRun(nextRun);
    },
    [run, selectedPinId],
  );

  const moveLeft = useCallback(() => {
    moveSelectedPin(1);
  }, [moveSelectedPin]);

  const moveRight = useCallback(() => {
    moveSelectedPin(-1);
  }, [moveSelectedPin]);

  const selectPreviousPin = useCallback(() => {
    if (!run) {
      return;
    }

    setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, -1));
  }, [run]);

  const selectNextPin = useCallback(() => {
    if (!run) {
      return;
    }

    setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, 1));
  }, [run]);

  const resetLock = useCallback(() => {
    if (!run || !initialLock) {
      return;
    }

    setRun(resetCurrentLock(run, initialLock));
    setInvalidMove({ pinId: -1, sequence: 0 });
  }, [initialLock, run]);

  const continueToNextChest = useCallback(() => {
    if (!run || !run.currentLock.isSolved) {
      return;
    }

    const nextRun = openSolvedChest(run);

    saveRunState(nextRun);
    setInvalidMove({ pinId: -1, sequence: 0 });
    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
  }, [run]);

  const startNewRun = useCallback(() => {
    const nextRun = createRun();

    setInvalidMove({ pinId: -1, sequence: 0 });
    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const handleStartNewRun = () => {
      startNewRun();
    };

    window.addEventListener(START_NEW_RUN_EVENT, handleStartNewRun);

    return () => {
      window.removeEventListener(START_NEW_RUN_EVENT, handleStartNewRun);
    };
  }, [startNewRun]);

  useEffect(() => {
    if (!run) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "a" || key === "arrowleft") {
        event.preventDefault();
        moveLeft();
        return;
      }

      if (key === "d" || key === "arrowright") {
        event.preventDefault();
        moveRight();
        return;
      }

      if (key === "w" || key === "arrowup") {
        event.preventDefault();
        selectPreviousPin();
        return;
      }

      if (key === "s" || key === "arrowdown") {
        event.preventDefault();
        selectNextPin();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        resetLock();
      }

      if (key === "n") {
        event.preventDefault();
        continueToNextChest();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    continueToNextChest,
    moveLeft,
    moveRight,
    resetLock,
    run,
    selectNextPin,
    selectPreviousPin,
  ]);

  if (!run) {
    return null;
  }

  const difficultyLevel = getDifficultyBand(run.chestIndex);

  return (
    <main className="flex flex-col items-center gap-6 my-8 min-h-[calc(100vh-8rem)]">
      <section className="flex flex-col items-center">
        <h2 className="font-heading text-4xl sm:text-5xl">{t.title}</h2>
        <div
          className="bg-foreground scale-75 sm:scale-100"
          style={{
            width: 310,
            height: 28,
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

        <div className="flex flex-col items-center gap-2 pt-4">
          <Difficulty level={difficultyLevel} />
          <p className="text-secondary sm:text-lg">
            {t.labels.chest}: #{run.chestIndex}
          </p>
        </div>
      </section>

      <Lock
        invalidMove={invalidMove}
        onSelectPin={setSelectedPinId}
        pins={run.currentLock.pins}
        selectedPinId={selectedPinId}
      />

      <section>
        <div className="flex flex-wrap gap-3 text-sm">
          <ItemFrame
            item={LockPickIcon.src}
            alt={t.labels.lockpick}
            width={64}
            height={64}
            amount={run.lockpicks}
          />
          <ItemFrame
            item={OreNuggetIcon.src}
            alt={t.labels.oreNuggets}
            width={64}
            height={64}
            amount={run.oreNuggets}
          />

          <Card className="flex items-center">
            <span aria-live="polite" aria-atomic="true">
              {t.labels.invalidMoves}:{" "}
              {run.currentLock.invalidMovesOnCurrentPick}/
              {run.currentLock.maxInvalidMovesPerPick}
            </span>
          </Card>
        </div>
      </section>

      <Movement
        onMoveLeft={moveLeft}
        onMoveRight={moveRight}
        onSelectPreviousPin={selectPreviousPin}
        onSelectNextPin={selectNextPin}
        onReset={resetLock}
        onContinueToNextChest={continueToNextChest}
      />
    </main>
  );
}
