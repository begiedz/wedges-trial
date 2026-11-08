"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/features/lock-debug/atoms/action-button";
import { MetricCard } from "@/features/lock-debug/atoms/metric-card";
import { SectionCard } from "@/features/lock-debug/atoms/section-card";
import { PinControlCard } from "@/features/lock-debug/molecules/pin-control-card";
import { PinTable } from "@/features/lock-debug/molecules/pin-table";
import { PinVisualizerRow } from "@/features/lock-debug/molecules/pin-visualizer-row";
import type { TextLockCopy } from "@/features/lock-debug/types";
import { applyMove } from "@/game/apply-move";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { createRun, openSolvedChest } from "@/game/create-run";
import { cloneLockState, resetCurrentLock } from "@/game/reset-lock";
import { solveLock } from "@/game/solver";
import type { ChestReward, Direction, LockState, RunState } from "@/game/types";
import { useDebugDictionary } from "@/i18n/provider";
import { getNextPinId } from "@/lib/pin-selection";

const MAX_EVENT_LOG_ITEMS = 8;

function pushEvent(log: string[], entry: string): string[] {
  return [entry, ...log].slice(0, MAX_EVENT_LOG_ITEMS);
}

function formatRuleText(
  t: TextLockCopy,
  sourcePinId: number,
  direction: Direction,
  effects: Array<{ pinId: number; delta: Direction }>,
): string {
  const directionLabel = direction === 1 ? t.labels.right : t.labels.left;

  return [
    `${t.labels.pinPrefix} ${sourcePinId} ${directionLabel}`,
    "->",
    effects
      .map((effect) => {
        const sign = effect.delta > 0 ? "+" : "";
        return `${t.labels.pinPrefix} ${effect.pinId} ${sign}${effect.delta}`;
      })
      .join(", "),
  ].join(" ");
}

function getStatusMessage(t: TextLockCopy, run: RunState | null): string {
  if (!run) {
    return t.messages.idle;
  }

  if (run.currentLock.isFailed || run.lockpicks <= 0) {
    return t.messages.failed;
  }

  if (run.currentLock.isSolved) {
    return t.messages.solved;
  }

  if (run.currentLock.invalidMovesOnCurrentPick > 0) {
    return t.messages.invalid;
  }

  return t.messages.active;
}

function getLockStateLabel(t: TextLockCopy, run: RunState | null): string {
  if (!run) {
    return t.states.active;
  }

  if (run.currentLock.isFailed || run.lockpicks <= 0) {
    return t.states.failed;
  }

  if (run.currentLock.isSolved) {
    return t.states.solved;
  }

  return t.states.active;
}

function applySelectedMove(
  run: RunState,
  selectedPinId: number | null,
  direction: Direction,
): RunState {
  if (selectedPinId === null) {
    return run;
  }

  return applyMove(run, selectedPinId, direction);
}

function describeMoveOutcome(
  t: TextLockCopy,
  previousRun: RunState,
  nextRun: RunState,
  pinId: number,
  direction: Direction,
): string {
  const directionLabel = direction === 1 ? t.labels.right : t.labels.left;
  const pinLabel = t.labels.pinPrefix;

  if (nextRun === previousRun) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${t.labels.ignoredEvent}`;
  }

  if (nextRun.currentLock.isSolved && !previousRun.currentLock.isSolved) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${t.labels.solvedChestEvent} ${previousRun.chestIndex}`;
  }

  if (nextRun.lockpicks < previousRun.lockpicks) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${t.labels.lockpickBrokeEvent}`;
  }

  if (
    nextRun.currentLock.invalidMovesOnCurrentPick >
    previousRun.currentLock.invalidMovesOnCurrentPick
  ) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${t.labels.invalidMoveEvent}`;
  }

  return `${pinLabel} ${pinId} ${directionLabel}: ${t.labels.movedEvent}`;
}

export function TextLockTester() {
  const t = useDebugDictionary();
  const [run, setRun] = useState<RunState | null>(null);
  const [initialLock, setInitialLock] = useState<LockState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [lastReward, setLastReward] = useState<ChestReward | null>(null);

  useEffect(() => {
    if (!run) {
      setSelectedPinId(null);
      return;
    }

    const selectedPinStillExists = run.currentLock.pins.some(
      (pin) => pin.id === selectedPinId,
    );

    if (!selectedPinStillExists) {
      setSelectedPinId(run.currentLock.pins[0]?.id ?? null);
    }
  }, [run, selectedPinId]);

  const startNewRun = () => {
    const nextRun = createRun();
    setRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
    setLastReward(null);
    setEventLog([`${t.labels.startedChestEvent} ${nextRun.chestIndex}`]);
  };

  const continueSavedRun = () => {
    if (!savedRun) {
      return;
    }

    setRun(savedRun);
    setInitialLock(cloneLockState(savedRun.currentLock));
    setSelectedPinId(savedRun.currentLock.pins[0]?.id ?? null);
    setLastReward(null);
    setEventLog((currentLog) =>
      pushEvent(
        currentLog,
        `${t.labels.continuedSavedChestEvent} ${savedRun.chestIndex}`,
      ),
    );
  };

  const movePin = useCallback(
    (pinId: number | null, direction: Direction) => {
      if (!run || pinId === null) {
        return;
      }

      const nextRun = applySelectedMove(run, pinId, direction);
      setRun(nextRun);
      setSelectedPinId(pinId);
      setEventLog((currentLog) =>
        pushEvent(
          currentLog,
          describeMoveOutcome(t, run, nextRun, pinId, direction),
        ),
      );
    },
    [run, t],
  );

  const resetLock = useCallback(() => {
    if (!run || !initialLock) {
      return;
    }

    const nextRun = resetCurrentLock(run, initialLock);
    setRun(nextRun);
    setLastReward(null);
    setEventLog((currentLog) =>
      pushEvent(
        currentLog,
        `${t.labels.resetChestEvent} ${run.chestIndex} ${t.labels.toInitialState}`,
      ),
    );
  }, [initialLock, run, t]);

  const continueToNextChest = () => {
    if (!run || !run.currentLock.isSolved) {
      return;
    }

    const nextRun = openSolvedChest(run);

    setRun(nextRun);
    setSavedRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
    setLastReward(nextRun.reward);
    setEventLog((currentLog) =>
      pushEvent(
        currentLog,
        `${t.labels.openedChestEvent} ${run.chestIndex}: +${nextRun.reward.oreNuggets} ${t.labels.oreUnit}, +${nextRun.reward.lockpicks} ${t.labels.rewardLockpicks}`,
      ),
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!run) {
        return;
      }

      if (event.key >= "1" && event.key <= "9") {
        const nextPinIndex = Number(event.key) - 1;
        const nextPin = run.currentLock.pins[nextPinIndex];

        if (nextPin) {
          setSelectedPinId(nextPin.id);
          setEventLog((currentLog) =>
            pushEvent(
              currentLog,
              `${t.labels.selectedPinFromKeyboardEvent} ${nextPin.id}`,
            ),
          );
          event.preventDefault();
        }

        return;
      }

      if (event.key === "a" || event.key === "ArrowLeft") {
        event.preventDefault();
        movePin(selectedPinId, 1);
        return;
      }

      if (event.key === "d" || event.key === "ArrowRight") {
        event.preventDefault();
        movePin(selectedPinId, -1);
        return;
      }

      if (event.key === "w" || event.key === "ArrowUp") {
        const nextPinId = getNextPinId(run.currentLock.pins, selectedPinId, 1);

        if (nextPinId !== null) {
          event.preventDefault();
          setSelectedPinId(nextPinId);
          setEventLog((currentLog) =>
            pushEvent(
              currentLog,
              `${t.labels.selectedPinFromKeyboardEvent} ${nextPinId}`,
            ),
          );
        }
        return;
      }

      if (event.key === "s" || event.key === "ArrowDown") {
        const nextPinId = getNextPinId(run.currentLock.pins, selectedPinId, -1);

        if (nextPinId !== null) {
          event.preventDefault();
          setSelectedPinId(nextPinId);
          setEventLog((currentLog) =>
            pushEvent(
              currentLog,
              `${t.labels.selectedPinFromKeyboardEvent} ${nextPinId}`,
            ),
          );
        }
        return;
      }

      if (event.key === "r") {
        event.preventDefault();
        resetLock();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    movePin,
    resetLock,
    run,
    selectedPinId,
    t.labels.selectedPinFromKeyboardEvent,
  ]);

  const selectedPin =
    run?.currentLock.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const solverPath = run ? solveLock(run.currentLock) : null;
  const selectPin = useCallback(
    (pinId: number) => {
      setSelectedPinId(pinId);
      setEventLog((currentLog) =>
        pushEvent(currentLog, `${t.labels.selectedPinEvent} ${pinId}`),
      );
    },
    [t.labels.selectedPinEvent],
  );

  return (
    <main className="flex flex-col gap-6 mx-auto px-4 sm:px-6 py-8 w-full max-w-5xl min-h-screen">
      <header className="space-y-3 bg-white/95 dark:bg-zinc-950/95 shadow-[0_18px_60px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <p className="font-semibold text-amber-700 dark:text-amber-300 text-xs uppercase tracking-[0.3em]">
          {t.labels.debugUi}
        </p>
        <h1 className="font-semibold text-zinc-950 dark:text-zinc-50 text-3xl sm:text-4xl tracking-tight">
          {t.title}
        </h1>
        <p className="max-w-3xl text-zinc-600 dark:text-zinc-300 text-sm sm:text-base leading-7">
          {t.subtitle}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={startNewRun} variant="accent">
            {t.actions.newRun}
          </ActionButton>
          <ActionButton disabled={!savedRun} onClick={continueSavedRun}>
            {t.actions.continueRun}
          </ActionButton>
          <ActionButton
            disabled={!run || !initialLock || run.currentLock.isFailed}
            onClick={resetLock}
          >
            {t.actions.reset}
          </ActionButton>
          <ActionButton
            disabled={!run?.currentLock.isSolved}
            onClick={continueToNextChest}
            variant="success"
          >
            {t.actions.continueToNextChest}
          </ActionButton>
        </div>
        {savedRun ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {t.messages.saved}
          </p>
        ) : null}
      </header>

      <section className="gap-4 grid lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 bg-white/90 dark:bg-zinc-950/90 p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <div className="gap-3 grid sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={t.labels.chest}
              value={run ? run.chestIndex : t.labels.noValue}
            />
            <MetricCard
              label={t.labels.oreNuggets}
              value={run?.oreNuggets ?? 0}
            />
            <MetricCard
              label={t.labels.lockpicks}
              value={run?.lockpicks ?? 0}
            />
            <MetricCard
              label={t.labels.invalidMoves}
              value={run?.currentLock.invalidMovesOnCurrentPick ?? 0}
            />
            <MetricCard
              label={t.labels.maxInvalidMoves}
              value={
                run?.currentLock.maxInvalidMovesPerPick ??
                MAX_INVALID_MOVES_PER_PICK
              }
            />
            <MetricCard
              label={t.labels.state}
              value={getLockStateLabel(t, run)}
            />
          </div>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.selectedPin}
            </p>
            <p className="mt-2 text-zinc-900 dark:text-zinc-100 text-lg">
              {selectedPin ? `#${selectedPin.id}` : t.labels.noValue}
            </p>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm">
              {t.labels.moveHint}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.pinColumns}
            </p>
            <div className="flex flex-col-reverse gap-3 mt-4">
              {run?.currentLock.pins.map((pin) => {
                return (
                  <PinVisualizerRow
                    isSelected={pin.id === selectedPinId}
                    key={`visual-${pin.id}`}
                    onSelect={selectPin}
                    pin={pin}
                  />
                );
              })}
              {!run ? (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  {t.messages.idle}
                </p>
              ) : null}
            </div>
          </SectionCard>

          <div className="gap-3 grid sm:grid-cols-2 xl:grid-cols-3">
            {run?.currentLock.pins.map((pin) => {
              return (
                <PinControlCard
                  isDisabled={run.currentLock.isFailed}
                  isSelected={pin.id === selectedPinId}
                  key={`control-${pin.id}`}
                  onMove={movePin}
                  onSelect={selectPin}
                  pin={pin}
                />
              );
            })}
          </div>

          <PinTable
            lock={run?.currentLock ?? null}
            onSelect={selectPin}
            selectedPinId={selectedPinId}
          />
        </div>

        <aside className="space-y-4 bg-white/90 dark:bg-zinc-950/90 p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <MetricCard
            label={t.labels.solverHint}
            value={solverPath ? solverPath.length : t.labels.noValue}
          />

          <SectionCard>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-7">
              {getStatusMessage(t, run)}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.rewardSummary}
            </p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm leading-7">
              {lastReward
                ? `+${lastReward.oreNuggets} ${t.labels.oreUnit}, +${lastReward.lockpicks} ${t.labels.rewardLockpicks}`
                : t.labels.noValue}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.keyboardHelp}
            </p>
            <ul className="space-y-2 mt-3 text-zinc-600 dark:text-zinc-300 text-sm leading-6">
              <li>{t.labels.keyboardSelectPin}</li>
              <li>{t.labels.keyboardSelectPreviousPin}</li>
              <li>{t.labels.keyboardSelectNextPin}</li>
              <li>{t.labels.keyboardMoveLeft}</li>
              <li>{t.labels.keyboardMoveRight}</li>
              <li>{t.labels.keyboardReset}</li>
            </ul>
          </SectionCard>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.eventLog}
            </p>
            <ul className="space-y-2 mt-3 font-mono text-zinc-700 dark:text-zinc-300 text-xs leading-6">
              {eventLog.length > 0 ? (
                eventLog.map((entry, index) => (
                  <li key={`${index}-${entry}`}>{entry}</li>
                ))
              ) : (
                <li>{t.messages.noEvents}</li>
              )}
            </ul>
          </SectionCard>

          <SectionCard>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs uppercase tracking-[0.24em]">
              {t.labels.rules}
            </p>
            <ul className="space-y-2 mt-3 font-mono text-zinc-700 dark:text-zinc-300 text-xs leading-6">
              {run?.currentLock.rules.map((rule) => (
                <li key={`${rule.sourcePinId}:${rule.direction}`}>
                  {formatRuleText(
                    t,
                    rule.sourcePinId,
                    rule.direction,
                    rule.effects,
                  )}
                </li>
              ))}
              {!run ? <li>{t.messages.idle}</li> : null}
            </ul>
          </SectionCard>
        </aside>
      </section>
    </main>
  );
}
