import { RUN_STORAGE_KEY } from "@/game/constants";
import type { LockState, MoveRule, Pin, RunState } from "@/game/types";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function isDirection(value: unknown): value is -1 | 1 {
  return value === -1 || value === 1;
}

function isPin(value: unknown): value is Pin {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pin = value as Record<string, unknown>;

  return (
    typeof pin.id === "number" &&
    typeof pin.position === "number" &&
    typeof pin.target === "number" &&
    typeof pin.min === "number" &&
    typeof pin.max === "number"
  );
}

function isMoveRule(value: unknown): value is MoveRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as Record<string, unknown>;

  return (
    typeof rule.sourcePinId === "number" &&
    isDirection(rule.direction) &&
    Array.isArray(rule.effects) &&
    rule.effects.every((effect) => {
      if (!effect || typeof effect !== "object") {
        return false;
      }

      const item = effect as Record<string, unknown>;

      return typeof item.pinId === "number" && isDirection(item.delta);
    })
  );
}

function isLockState(value: unknown): value is LockState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const lock = value as Record<string, unknown>;

  return (
    Array.isArray(lock.pins) &&
    lock.pins.length > 0 &&
    lock.pins.every(isPin) &&
    Array.isArray(lock.rules) &&
    lock.rules.every(isMoveRule) &&
    typeof lock.invalidMovesOnCurrentPick === "number" &&
    typeof lock.maxInvalidMovesPerPick === "number" &&
    typeof lock.isSolved === "boolean" &&
    typeof lock.isFailed === "boolean"
  );
}

export function isRunState(value: unknown): value is RunState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const run = value as Record<string, unknown>;

  return (
    typeof run.chestIndex === "number" &&
    typeof run.oreNuggets === "number" &&
    typeof run.lockpicks === "number" &&
    isLockState(run.currentLock)
  );
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function saveRunState(run: RunState, storage?: StorageLike): boolean {
  const target = resolveStorage(storage);

  if (!target) {
    return false;
  }

  target.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
  return true;
}

export function loadRunState(storage?: StorageLike): RunState | null {
  const target = resolveStorage(storage);

  if (!target) {
    return null;
  }

  const raw = target.getItem(RUN_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (isRunState(parsed)) {
      return parsed;
    }

    target.removeItem(RUN_STORAGE_KEY);
    return null;
  } catch {
    target.removeItem(RUN_STORAGE_KEY);
    return null;
  }
}

export function clearRunState(storage?: StorageLike): boolean {
  const target = resolveStorage(storage);

  if (!target) {
    return false;
  }

  target.removeItem(RUN_STORAGE_KEY);
  return true;
}
