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
import { getDifficultyBand } from "@/game/progressDifficulty";
import type { Direction, RunState } from "@/game/types";
import { useGameDictionary } from "@/i18n/provider";
import { ChestRewardDialog } from "./ChestRewardDialog";
import { DialogAction } from "./GameDialog";
import { RestartRunDialog } from "./RestartRunDialog";
import { RunFailedDialog } from "./RunFailedDialog";
import { useGameSession } from "./useGameSession";

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
  const {
    run,
    reward,
    rewardOpen,
    setRewardOpen,
    restartOpen,
    setRestartOpen,
    move,
    continueToNextChest,
    resetLock: resetSessionLock,
    startNewRun,
    requestNewRun,
  } = useGameSession();
  const interactionBlocked =
    !run || run.currentLock.isSolved || run.currentLock.isFailed || restartOpen;
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [invalidMove, setInvalidMove] = useState({ pinId: -1, sequence: 0 });

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
      if (!run || selectedPinId === null || interactionBlocked) {
        return;
      }

      const nextRun = move(selectedPinId, direction);
      if (!nextRun) return;

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
    },
    [run, selectedPinId, interactionBlocked, move],
  );

  const moveLeft = useCallback(() => {
    moveSelectedPin(1);
  }, [moveSelectedPin]);

  const moveRight = useCallback(() => {
    moveSelectedPin(-1);
  }, [moveSelectedPin]);

  const selectPreviousPin = useCallback(() => {
    if (!run || interactionBlocked) {
      return;
    }

    setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, -1));
  }, [run, interactionBlocked]);

  const selectNextPin = useCallback(() => {
    if (!run || interactionBlocked) {
      return;
    }

    setSelectedPinId((currentPinId) => getNextPinId(run, currentPinId, 1));
  }, [run, interactionBlocked]);

  const resetLock = useCallback(() => {
    if (interactionBlocked) return;
    resetSessionLock();
    setInvalidMove({ pinId: -1, sequence: 0 });
  }, [interactionBlocked, resetSessionLock]);

  useEffect(() => {
    const handleStartNewRun = () => {
      requestNewRun();
    };

    window.addEventListener(START_NEW_RUN_EVENT, handleStartNewRun);

    return () => {
      window.removeEventListener(START_NEW_RUN_EVENT, handleStartNewRun);
    };
  }, [requestNewRun]);

  useEffect(() => {
    if (!run) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        rewardOpen ||
        restartOpen ||
        run.currentLock.isFailed
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog]",
        )
      )
        return;
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
        if (reward) setRewardOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    reward,
    rewardOpen,
    restartOpen,
    setRewardOpen,
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
        onSelectPin={interactionBlocked ? undefined : setSelectedPinId}
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

      {reward && !rewardOpen && (
        <DialogAction onClick={() => setRewardOpen(true)}>
          {t.dialogs.backToReward}
        </DialogAction>
      )}

      <Movement
        onMoveLeft={moveLeft}
        onMoveRight={moveRight}
        onSelectPreviousPin={selectPreviousPin}
        onSelectNextPin={selectNextPin}
        onReset={resetLock}
        onContinueToNextChest={() => {
          if (reward) setRewardOpen(true);
        }}
        disabled={interactionBlocked}
        continueDisabled={!reward || restartOpen}
      />
      {reward && (
        <ChestRewardDialog
          open={rewardOpen && !restartOpen}
          onOpenChange={setRewardOpen}
          reward={reward}
          totalOre={run.oreNuggets + reward.oreNuggets}
          onContinue={() => {
            continueToNextChest();
            setSelectedPinId(null);
            setInvalidMove({ pinId: -1, sequence: 0 });
          }}
        />
      )}
      <RunFailedDialog
        open={run.currentLock.isFailed && !restartOpen}
        oreNuggets={run.oreNuggets}
        openedChests={Math.max(0, run.chestIndex - 1)}
        onNewRun={requestNewRun}
      />
      <RestartRunDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        onConfirm={() => {
          startNewRun();
          setSelectedPinId(null);
          setInvalidMove({ pinId: -1, sequence: 0 });
        }}
      />
    </main>
  );
}
