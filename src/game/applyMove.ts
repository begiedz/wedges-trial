import { checkSolved } from "@/game/checkSolved";
import type { Direction, LockState, MoveRule, RunState } from "@/game/types";
import { evaluateRule } from "./movement";

type LockMoveResult =
  | {
      kind: "ignored";
      lock: LockState;
    }
  | {
      kind: "invalid";
      lock: LockState;
    }
  | {
      kind: "valid";
      lock: LockState;
    };

function findMoveRule(
  rules: MoveRule[],
  pinId: number,
  direction: Direction,
): MoveRule | undefined {
  return rules.find(
    (rule) => rule.sourcePinId === pinId && rule.direction === direction,
  );
}

export function applyMoveToLock(
  lock: LockState,
  pinId: number,
  direction: Direction,
): LockMoveResult {
  if (lock.isSolved || lock.isFailed) {
    return {
      kind: "ignored",
      lock,
    };
  }

  const rule = findMoveRule(lock.rules, pinId, direction);

  if (!rule) {
    return {
      kind: "ignored",
      lock,
    };
  }

  const evaluated = evaluateRule(lock.pins, rule);
  if (evaluated.kind !== "valid") return { kind: evaluated.kind, lock };
  const nextPins = evaluated.pins;
  const solved = checkSolved({ pins: nextPins });

  return {
    kind: "valid",
    lock: {
      ...lock,
      pins: nextPins,
      isSolved: solved,
    },
  };
}

export function applyInvalidMoveToRun(run: RunState): RunState {
  const nextInvalidMoves = run.currentLock.invalidMovesOnCurrentPick + 1;

  if (nextInvalidMoves < run.currentLock.maxInvalidMovesPerPick) {
    return {
      ...run,
      currentLock: {
        ...run.currentLock,
        invalidMovesOnCurrentPick: nextInvalidMoves,
      },
    };
  }

  const nextLockpicks = Math.max(0, run.lockpicks - 1);

  return {
    ...run,
    lockpicks: nextLockpicks,
    currentLock: {
      ...run.currentLock,
      invalidMovesOnCurrentPick: 0,
      isFailed: nextLockpicks === 0,
    },
  };
}

export function applyValidMoveToRun(run: RunState, lock: LockState): RunState {
  return {
    ...run,
    currentLock: {
      ...lock,
      invalidMovesOnCurrentPick: run.currentLock.invalidMovesOnCurrentPick,
      isFailed: run.lockpicks === 0,
    },
  };
}

export function evaluateMove(
  run: RunState,
  pinId: number,
  direction: Direction,
): { kind: LockMoveResult["kind"]; run: RunState } {
  if (
    run.currentLock.isSolved ||
    run.currentLock.isFailed ||
    run.lockpicks <= 0
  ) {
    return { kind: "ignored", run };
  }
  const result = applyMoveToLock(run.currentLock, pinId, direction);
  switch (result.kind) {
    case "ignored":
      return { kind: result.kind, run };
    case "invalid":
      return { kind: result.kind, run: applyInvalidMoveToRun(run) };
    case "valid":
      return { kind: result.kind, run: applyValidMoveToRun(run, result.lock) };
  }
}

export function applyMove(
  run: RunState,
  pinId: number,
  direction: Direction,
): RunState {
  return evaluateMove(run, pinId, direction).run;
}
