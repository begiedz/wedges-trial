import type { LockState } from "@/game/types";

export function checkSolved(lock: Pick<LockState, "pins">): boolean {
  return lock.pins.every((pin) => pin.position === pin.target);
}
