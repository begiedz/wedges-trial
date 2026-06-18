"use client";

import { useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/text-lock/atoms/ActionButton";
import { MetricCard } from "@/components/text-lock/atoms/MetricCard";
import { SectionCard } from "@/components/text-lock/atoms/SectionCard";
import { PinControlCard } from "@/components/text-lock/molecules/PinControlCard";
import { PinTable } from "@/components/text-lock/molecules/PinTable";
import { PinVisualizerRow } from "@/components/text-lock/molecules/PinVisualizerRow";
import type { TextLockCopy } from "@/components/text-lock/types";
import { applyMove } from "@/game/applyMove";
import { createRun, openSolvedChest } from "@/game/createRun";
import { loadRunState, saveRunState } from "@/game/persistence";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import { solveLock } from "@/game/solver";
import type { ChestReward, Direction, LockState, RunState } from "@/game/types";

type TextLockTesterProps = {
  copy: TextLockCopy;
};

const MAX_EVENT_LOG_ITEMS = 8;

function pushEvent(log: string[], entry: string): string[] {
  return [entry, ...log].slice(0, MAX_EVENT_LOG_ITEMS);
}

function getNextSelectedPinId(
  pins: LockState["pins"],
  selectedPinId: number | null,
  offset: number,
): number | null {
  if (pins.length === 0) {
    return null;
  }

  const currentIndex = pins.findIndex((pin) => pin.id === selectedPinId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + offset + pins.length) % pins.length;
  return pins[nextIndex]?.id ?? null;
}

function formatRuleText(
  copy: TextLockCopy,
  sourcePinId: number,
  direction: Direction,
  effects: Array<{ pinId: number; delta: Direction }>,
): string {
  const directionLabel = direction === 1 ? copy.labels.right : copy.labels.left;

  return [
    `${copy.labels.pinPrefix} ${sourcePinId} ${directionLabel}`,
    "->",
    effects
      .map((effect) => {
        const sign = effect.delta > 0 ? "+" : "";
        return `${copy.labels.pinPrefix} ${effect.pinId} ${sign}${effect.delta}`;
      })
      .join(", "),
  ].join(" ");
}

function getStatusMessage(copy: TextLockCopy, run: RunState | null): string {
  if (!run) {
    return copy.messages.idle;
  }

  if (run.currentLock.isFailed || run.lockpicks <= 0) {
    return copy.messages.failed;
  }

  if (run.currentLock.isSolved) {
    return copy.messages.solved;
  }

  if (run.currentLock.invalidMovesOnCurrentPick > 0) {
    return copy.messages.invalid;
  }

  return copy.messages.active;
}

function getLockStateLabel(copy: TextLockCopy, run: RunState | null): string {
  if (!run) {
    return copy.states.active;
  }

  if (run.currentLock.isFailed || run.lockpicks <= 0) {
    return copy.states.failed;
  }

  if (run.currentLock.isSolved) {
    return copy.states.solved;
  }

  return copy.states.active;
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
  copy: TextLockCopy,
  previousRun: RunState,
  nextRun: RunState,
  pinId: number,
  direction: Direction,
): string {
  const directionLabel = direction === 1 ? copy.labels.right : copy.labels.left;
  const pinLabel = copy.labels.pinPrefix;

  if (nextRun === previousRun) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${copy.labels.ignoredEvent}`;
  }

  if (nextRun.currentLock.isSolved && !previousRun.currentLock.isSolved) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${copy.labels.solvedChestEvent} ${previousRun.chestIndex + 1}`;
  }

  if (nextRun.lockpicks < previousRun.lockpicks) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${copy.labels.lockpickBrokeEvent}`;
  }

  if (
    nextRun.currentLock.invalidMovesOnCurrentPick >
    previousRun.currentLock.invalidMovesOnCurrentPick
  ) {
    return `${pinLabel} ${pinId} ${directionLabel}: ${copy.labels.invalidMoveEvent}`;
  }

  return `${pinLabel} ${pinId} ${directionLabel}: ${copy.labels.movedEvent}`;
}

export function TextLockTester({ copy }: TextLockTesterProps) {
  const [run, setRun] = useState<RunState | null>(null);
  const [initialLock, setInitialLock] = useState<LockState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [lastReward, setLastReward] = useState<ChestReward | null>(null);

  useEffect(() => {
    const persistedRun = loadRunState();

    if (persistedRun) {
      setSavedRun(persistedRun);
    }
  }, []);

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
    setEventLog([`${copy.labels.startedChestEvent} ${nextRun.chestIndex + 1}`]);
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
        `${copy.labels.continuedSavedChestEvent} ${savedRun.chestIndex + 1}`,
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
          describeMoveOutcome(copy, run, nextRun, pinId, direction),
        ),
      );
    },
    [copy, run],
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
        `${copy.labels.resetChestEvent} ${run.chestIndex + 1} ${copy.labels.toInitialState}`,
      ),
    );
  }, [copy, initialLock, run]);

  const continueToNextChest = () => {
    if (!run || !run.currentLock.isSolved) {
      return;
    }

    const nextRun = openSolvedChest(run);
    saveRunState(nextRun);
    setRun(nextRun);
    setSavedRun(nextRun);
    setInitialLock(cloneLockState(nextRun.currentLock));
    setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);
    setLastReward(nextRun.reward);
    setEventLog((currentLog) =>
      pushEvent(
        currentLog,
        `${copy.labels.openedChestEvent} ${run.chestIndex + 1}: +${nextRun.reward.oreNuggets} ${copy.labels.oreUnit}, +${nextRun.reward.lockpicks} ${copy.labels.rewardLockpicks}`,
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
              `${copy.labels.selectedPinFromKeyboardEvent} ${nextPin.id}`,
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
        const nextPinId = getNextSelectedPinId(
          run.currentLock.pins,
          selectedPinId,
          1,
        );

        if (nextPinId !== null) {
          event.preventDefault();
          setSelectedPinId(nextPinId);
          setEventLog((currentLog) =>
            pushEvent(
              currentLog,
              `${copy.labels.selectedPinFromKeyboardEvent} ${nextPinId}`,
            ),
          );
        }
        return;
      }

      if (event.key === "s" || event.key === "ArrowDown") {
        const nextPinId = getNextSelectedPinId(
          run.currentLock.pins,
          selectedPinId,
          -1,
        );

        if (nextPinId !== null) {
          event.preventDefault();
          setSelectedPinId(nextPinId);
          setEventLog((currentLog) =>
            pushEvent(
              currentLog,
              `${copy.labels.selectedPinFromKeyboardEvent} ${nextPinId}`,
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
    copy.labels.selectedPinFromKeyboardEvent,
    movePin,
    resetLock,
    run,
    selectedPinId,
  ]);

  const selectedPin =
    run?.currentLock.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const solverPath = run ? solveLock(run.currentLock) : null;
  const selectPin = useCallback(
    (pinId: number) => {
      setSelectedPinId(pinId);
      setEventLog((currentLog) =>
        pushEvent(currentLog, `${copy.labels.selectedPinEvent} ${pinId}`),
      );
    },
    [copy.labels.selectedPinEvent],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-3 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)] dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
          {copy.labels.debugUi}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
          {copy.subtitle}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={startNewRun} variant="accent">
            {copy.actions.newRun}
          </ActionButton>
          <ActionButton disabled={!savedRun} onClick={continueSavedRun}>
            {copy.actions.continueRun}
          </ActionButton>
          <ActionButton
            disabled={!run || !initialLock || run.currentLock.isFailed}
            onClick={resetLock}
          >
            {copy.actions.reset}
          </ActionButton>
          <ActionButton
            disabled={!run?.currentLock.isSolved}
            onClick={continueToNextChest}
            variant="success"
          >
            {copy.actions.continueToNextChest}
          </ActionButton>
        </div>
        {savedRun ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {copy.messages.saved}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-5 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={copy.labels.chest}
              value={run ? run.chestIndex + 1 : copy.labels.noValue}
            />
            <MetricCard
              label={copy.labels.oreNuggets}
              value={run?.oreNuggets ?? 0}
            />
            <MetricCard
              label={copy.labels.lockpicks}
              value={run?.lockpicks ?? 0}
            />
            <MetricCard
              label={copy.labels.invalidMoves}
              value={run?.currentLock.invalidMovesOnCurrentPick ?? 0}
            />
            <MetricCard
              label={copy.labels.maxInvalidMoves}
              value={run?.currentLock.maxInvalidMovesPerPick ?? 3}
            />
            <MetricCard
              label={copy.labels.state}
              value={getLockStateLabel(copy, run)}
            />
          </div>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.selectedPin}
            </p>
            <p className="mt-2 text-lg text-zinc-900 dark:text-zinc-100">
              {selectedPin ? `#${selectedPin.id}` : copy.labels.noValue}
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {copy.labels.moveHint}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.pinColumns}
            </p>
            <div className="mt-4 flex flex-col-reverse gap-3">
              {run?.currentLock.pins.map((pin) => {
                return (
                  <PinVisualizerRow
                    copy={copy}
                    isSelected={pin.id === selectedPinId}
                    key={`visual-${pin.id}`}
                    onSelect={selectPin}
                    pin={pin}
                  />
                );
              })}
              {!run ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {copy.messages.idle}
                </p>
              ) : null}
            </div>
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {run?.currentLock.pins.map((pin) => {
              return (
                <PinControlCard
                  copy={copy}
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
            copy={copy}
            lock={run?.currentLock ?? null}
            onSelect={selectPin}
            selectedPinId={selectedPinId}
          />
        </div>

        <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-5 dark:border-zinc-800 dark:bg-zinc-950/90">
          <MetricCard
            label={copy.labels.solverHint}
            value={solverPath ? solverPath.length : copy.labels.noValue}
          />

          <SectionCard>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {getStatusMessage(copy, run)}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.rewardSummary}
            </p>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {lastReward
                ? `+${lastReward.oreNuggets} ${copy.labels.oreUnit}, +${lastReward.lockpicks} ${copy.labels.rewardLockpicks}`
                : copy.labels.noValue}
            </p>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.keyboardHelp}
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>{copy.labels.keyboardSelectPin}</li>
              <li>{copy.labels.keyboardSelectPreviousPin}</li>
              <li>{copy.labels.keyboardSelectNextPin}</li>
              <li>{copy.labels.keyboardMoveLeft}</li>
              <li>{copy.labels.keyboardMoveRight}</li>
              <li>{copy.labels.keyboardReset}</li>
            </ul>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.eventLog}
            </p>
            <ul className="mt-3 space-y-2 font-mono text-xs leading-6 text-zinc-700 dark:text-zinc-300">
              {eventLog.length > 0 ? (
                eventLog.map((entry, index) => (
                  <li key={`${index}-${entry}`}>{entry}</li>
                ))
              ) : (
                <li>{copy.messages.noEvents}</li>
              )}
            </ul>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.rules}
            </p>
            <ul className="mt-3 space-y-2 font-mono text-xs leading-6 text-zinc-700 dark:text-zinc-300">
              {run?.currentLock.rules.map((rule) => (
                <li key={`${rule.sourcePinId}:${rule.direction}`}>
                  {formatRuleText(
                    copy,
                    rule.sourcePinId,
                    rule.direction,
                    rule.effects,
                  )}
                </li>
              ))}
              {!run ? <li>{copy.messages.idle}</li> : null}
            </ul>
          </SectionCard>
        </aside>
      </section>
    </main>
  );
}
