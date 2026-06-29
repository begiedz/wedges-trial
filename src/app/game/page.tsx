"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { textLockCopy } from "@/app/textLockCopy";
import LockPickIcon from "@/assets/images/icons/items/T_ItemIcon_ItKe_Lockpick.png";
import OreNuggetIcon from "@/assets/images/icons/items/T_ItemIcon_ItMi_Orenugget.png";
import LockEmptyIcon from "@/assets/images/icons/T_LockDifficulty_Empty.png";
import Separator from "@/assets/images/T_TitleLine_Small.png";
import Card from "@/components/general/atoms/card";
import ItemFrame from "@/components/general/molecules/item-frame";
import Movement from "@/components/general/molecules/movement";
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
          <Image src={LockEmptyIcon.src} alt="" width={24} height={24} />
          <Image src={LockEmptyIcon.src} alt="" width={24} height={24} />
          <Image src={LockEmptyIcon.src} alt="" width={24} height={24} />
          <Image src={LockEmptyIcon.src} alt="" width={24} height={24} />
        </div>
      </div>

      {/* Game */}

      <Lock
        onSelectPin={setSelectedPinId}
        pins={run.currentLock.pins}
        selectedPinId={selectedPinId}
      />

      {/* Resources */}
      <section>
        <div className="flex flex-wrap gap-3 text-sm">
          <ItemFrame
            item={LockPickIcon.src}
            alt="Lockpick"
            width={64}
            height={64}
            amount={run.lockpicks}
          />
          <ItemFrame
            item={OreNuggetIcon.src}
            alt="Ore Nuggets"
            width={64}
            height={64}
            amount={run.oreNuggets}
          />

          <Card>
            {textLockCopy.labels.invalidMoves}:{" "}
            {run.currentLock.invalidMovesOnCurrentPick}/
            {run.currentLock.maxInvalidMovesPerPick}
          </Card>
        </div>
      </section>

      <Movement />
    </main>
  );
}
