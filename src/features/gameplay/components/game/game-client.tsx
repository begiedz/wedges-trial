"use client";

import { useCallback, useEffect, useState } from "react";
import LockPickIcon from "@/assets/images/icons/items/T_ItemIcon_ItKe_Lockpick.png";
import OreNuggetIcon from "@/assets/images/icons/items/T_ItemIcon_ItMi_Orenugget.png";
import Separator from "@/assets/images/T_TitleLine_Small.png";
import Card from "@/components/general/atoms/card";
import Difficulty from "@/features/gameplay/components/game/difficulty";
import ItemFrame from "@/features/gameplay/components/game/item-frame";
import Movement from "@/features/gameplay/components/game/movement";
import Lock from "@/features/gameplay/components/lock";
import { onNewRunRequested } from "@/features/gameplay/events";
import type { Direction } from "@/game/types";
import { useGameDictionary } from "@/i18n/provider";
import { getNextPinId } from "@/lib/pin-selection";
import { useGameKeyboard } from "../../hooks/use-game-keyboard";
import { useGameSession } from "../../hooks/use-game-session";
import { ChestRewardDialog } from "./chest-reward-dialog";
import { DialogAction } from "./game-dialog";
import { RestartRunDialog } from "./restart-run-dialog";
import { RunFailedDialog } from "./run-failed-dialog";

export function GameClient() {
  const t = useGameDictionary();
  const {
    loading,
    error,
    retry,
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
    !run || loading || error || run.status !== "playing" || restartOpen;
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
    async (direction: Direction) => {
      if (!run || selectedPinId === null || interactionBlocked) {
        return;
      }

      const reply = await move(selectedPinId, direction);
      const nextRun = reply?.run;
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

    setSelectedPinId((currentPinId) =>
      getNextPinId(run.currentLock.pins, currentPinId, -1),
    );
  }, [run, interactionBlocked]);

  const selectNextPin = useCallback(() => {
    if (!run || interactionBlocked) {
      return;
    }

    setSelectedPinId((currentPinId) =>
      getNextPinId(run.currentLock.pins, currentPinId, 1),
    );
  }, [run, interactionBlocked]);

  const resetLock = useCallback(() => {
    if (interactionBlocked) return;
    resetSessionLock();
    setInvalidMove({ pinId: -1, sequence: 0 });
  }, [interactionBlocked, resetSessionLock]);

  useEffect(() => onNewRunRequested(requestNewRun), [requestNewRun]);

  useGameKeyboard({
    enabled: !!run && !rewardOpen && !restartOpen && run.status !== "finished",
    moveLeft,
    moveRight,
    selectPreviousPin,
    selectNextPin,
    resetLock,
    showReward: () => {
      if (reward) setRewardOpen(true);
    },
  });

  if (!run) {
    return (
      <main aria-live="polite">
        {error ? (
          <>
            <p>{t.connection.error}</p>
            <DialogAction onClick={() => void retry()}>
              {t.connection.retry}
            </DialogAction>
          </>
        ) : (
          t.connection.loading
        )}
      </main>
    );
  }

  const difficultyLevel = run.difficulty;

  return (
    <main
      aria-busy={loading}
      className="flex flex-col items-center gap-6 my-8 min-h-[calc(100vh-8rem)]"
    >
      <div aria-live="polite">
        {error ? (
          <>
            <p>{t.connection.error}</p>
            <DialogAction onClick={() => void retry()}>
              {t.connection.retry}
            </DialogAction>
          </>
        ) : null}
      </div>
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
          open={rewardOpen && !restartOpen && !error}
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
        open={run.status === "finished" && !restartOpen && !error}
        result={run.result}
        onNewRun={requestNewRun}
      />
      <RestartRunDialog
        open={restartOpen && !error}
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
