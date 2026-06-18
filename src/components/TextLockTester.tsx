"use client";

import { useEffect, useState } from "react";

import { applyMove } from "@/game/applyMove";
import { createRun, openSolvedChest } from "@/game/createRun";
import { loadRunState, saveRunState } from "@/game/persistence";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import { solveLock } from "@/game/solver";
import type { Direction, LockState, RunState } from "@/game/types";

type TextLockCopy = {
  actions: Record<string, string>;
  labels: Record<string, string>;
  messages: Record<string, string>;
  states: Record<string, string>;
  subtitle: string;
  title: string;
};

type TextLockTesterProps = {
  copy: TextLockCopy;
};

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

export function TextLockTester({ copy }: TextLockTesterProps) {
  const [run, setRun] = useState<RunState | null>(null);
  const [initialLock, setInitialLock] = useState<LockState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);

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
  };

  const continueSavedRun = () => {
    if (!savedRun) {
      return;
    }

    setRun(savedRun);
    setInitialLock(cloneLockState(savedRun.currentLock));
    setSelectedPinId(savedRun.currentLock.pins[0]?.id ?? null);
  };

  const moveSelectedPin = (direction: Direction) => {
    setRun((currentRun) => {
      if (!currentRun) {
        return currentRun;
      }

      return applySelectedMove(currentRun, selectedPinId, direction);
    });
  };

  const resetLock = () => {
    setRun((currentRun) => {
      if (!currentRun || !initialLock) {
        return currentRun;
      }

      return resetCurrentLock(currentRun, initialLock);
    });
  };

  const continueToNextChest = () => {
    setRun((currentRun) => {
      if (!currentRun || !currentRun.currentLock.isSolved) {
        return currentRun;
      }

      const nextRun = openSolvedChest(currentRun);
      saveRunState(nextRun);
      setSavedRun(nextRun);
      setInitialLock(cloneLockState(nextRun.currentLock));
      setSelectedPinId(nextRun.currentLock.pins[0]?.id ?? null);

      return nextRun;
    });
  };

  const selectedPin =
    run?.currentLock.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const solverPath = run ? solveLock(run.currentLock) : null;

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
          <button
            className="rounded-md border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
            onClick={startNewRun}
            type="button"
          >
            {copy.actions.newRun}
          </button>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100"
            disabled={!savedRun}
            onClick={continueSavedRun}
            type="button"
          >
            {copy.actions.continueRun}
          </button>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100"
            disabled={!run || !initialLock || run.currentLock.isFailed}
            onClick={resetLock}
            type="button"
          >
            {copy.actions.reset}
          </button>
          <button
            className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-100"
            disabled={!run?.currentLock.isSolved}
            onClick={continueToNextChest}
            type="button"
          >
            {copy.actions.continueToNextChest}
          </button>
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
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.chest}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {run ? run.chestIndex + 1 : copy.labels.noValue}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.oreNuggets}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {run?.oreNuggets ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.lockpicks}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {run?.lockpicks ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.invalidMoves}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {run?.currentLock.invalidMovesOnCurrentPick ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.maxInvalidMoves}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {run?.currentLock.maxInvalidMovesPerPick ?? 3}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {copy.labels.state}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {getLockStateLabel(copy, run)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.selectedPin}
            </p>
            <p className="mt-2 text-lg text-zinc-900 dark:text-zinc-100">
              {selectedPin ? `#${selectedPin.id}` : copy.labels.noValue}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{copy.labels.pin}</th>
                  <th className="px-4 py-3 font-medium">
                    {copy.labels.position}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {copy.labels.target}
                  </th>
                  <th className="px-4 py-3 font-medium">{copy.labels.range}</th>
                  <th className="px-4 py-3 font-medium">
                    {copy.actions.selectPin}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white/90 dark:divide-zinc-800 dark:bg-zinc-950/80">
                {run?.currentLock.pins.map((pin) => {
                  const isSelected = pin.id === selectedPinId;
                  const isOnTarget = pin.position === pin.target;

                  return (
                    <tr
                      className={
                        isSelected
                          ? "bg-amber-500/10"
                          : isOnTarget
                            ? "bg-emerald-500/10"
                            : ""
                      }
                      key={pin.id}
                    >
                      <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                        #{pin.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                        {pin.position}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                        {pin.target}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                        {pin.min}..{pin.max}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
                          disabled={run.currentLock.isFailed}
                          onClick={() => setSelectedPinId(pin.id)}
                          type="button"
                        >
                          {copy.actions.selectPin}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!run ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-zinc-500 dark:text-zinc-400"
                      colSpan={5}
                    >
                      {copy.messages.idle}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-5 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
              {copy.labels.solverHint}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {solverPath ? solverPath.length : copy.labels.noValue}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100"
              disabled={
                !run || selectedPinId === null || run.currentLock.isFailed
              }
              onClick={() => moveSelectedPin(-1)}
              type="button"
            >
              {copy.actions.moveLeft}
            </button>
            <button
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100"
              disabled={
                !run || selectedPinId === null || run.currentLock.isFailed
              }
              onClick={() => moveSelectedPin(1)}
              type="button"
            >
              {copy.actions.moveRight}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {getStatusMessage(copy, run)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
          </div>
        </aside>
      </section>
    </main>
  );
}
