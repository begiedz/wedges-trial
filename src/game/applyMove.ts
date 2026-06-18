import { checkSolved } from "@/game/checkSolved";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import type { Direction, LockState, MoveRule, RunState } from "@/game/types";

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

  const nextPositions = new Map<number, number>();

  for (const pin of lock.pins) {
    nextPositions.set(pin.id, pin.position);
  }

  for (const effect of rule.effects) {
    const currentPosition = nextPositions.get(effect.pinId);

    if (currentPosition === undefined) {
      return {
        kind: "ignored",
        lock,
      };
    }

    nextPositions.set(effect.pinId, currentPosition + effect.delta);
  }

  const hasOutOfBoundsPin = lock.pins.some((pin) => {
    const nextPosition = nextPositions.get(pin.id) ?? pin.position;
    return nextPosition < pin.min || nextPosition > pin.max;
  });

  if (hasOutOfBoundsPin) {
    return {
      kind: "invalid",
      lock,
    };
  }

  const nextPins = lock.pins.map((pin) => ({
    ...pin,
    position: nextPositions.get(pin.id) ?? pin.position,
  }));
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

  if (nextInvalidMoves < MAX_INVALID_MOVES_PER_PICK) {
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

export function applyMove(
  run: RunState,
  pinId: number,
  direction: Direction,
): RunState {
  if (
    run.currentLock.isSolved ||
    run.currentLock.isFailed ||
    run.lockpicks <= 0
  ) {
    return run;
  }

  const result = applyMoveToLock(run.currentLock, pinId, direction);

  if (result.kind === "ignored") {
    return run;
  }

  if (result.kind === "invalid") {
    return applyInvalidMoveToRun(run);
  }

  return applyValidMoveToRun(run, result.lock);
}
