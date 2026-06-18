import type { LockState, RunState } from "@/game/types";

function cloneLock(lock: LockState): LockState {
  return {
    ...lock,
    pins: lock.pins.map((pin) => ({ ...pin })),
    rules: lock.rules.map((rule) => ({
      ...rule,
      effects: rule.effects.map((effect) => ({ ...effect })),
    })),
  };
}

export function resetCurrentLock(
  run: RunState,
  initialLock: LockState,
): RunState {
  if (run.lockpicks <= 0 || run.currentLock.isFailed) {
    return run;
  }

  return {
    ...run,
    currentLock: {
      ...cloneLock(initialLock),
      isFailed: false,
    },
  };
}

export function cloneLockState(lock: LockState): LockState {
  return cloneLock(lock);
}
