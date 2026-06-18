import { checkSolved } from "@/game/checkSolved";
import type { LockMove, LockState } from "@/game/types";

function serializePositions(lock: Pick<LockState, "pins">): string {
  return lock.pins.map((pin) => pin.position).join(",");
}

export function solveLock(
  lock: LockState,
  maxVisitedStates = 20_000,
): LockMove[] | null {
  const queue: Array<{ lock: LockState; path: LockMove[] }> = [
    {
      lock,
      path: [],
    },
  ];
  const visited = new Set([serializePositions(lock)]);

  while (queue.length > 0 && visited.size <= maxVisitedStates) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    if (checkSolved(current.lock)) {
      return current.path;
    }

    for (const rule of current.lock.rules) {
      const nextPositions = new Map(
        current.lock.pins.map((pin) => [pin.id, pin.position]),
      );
      let valid = true;

      for (const effect of rule.effects) {
        const currentPosition = nextPositions.get(effect.pinId);

        if (currentPosition === undefined) {
          valid = false;
          break;
        }

        nextPositions.set(effect.pinId, currentPosition + effect.delta);
      }

      if (!valid) {
        continue;
      }

      const nextPins = current.lock.pins.map((pin) => ({
        ...pin,
        position: nextPositions.get(pin.id) ?? pin.position,
      }));

      if (
        nextPins.some((pin) => pin.position < pin.min || pin.position > pin.max)
      ) {
        continue;
      }

      const nextLock: LockState = {
        ...current.lock,
        pins: nextPins,
      };
      const key = serializePositions(nextLock);

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({
        lock: nextLock,
        path: [
          ...current.path,
          {
            pinId: rule.sourcePinId,
            direction: rule.direction,
          },
        ],
      });
    }
  }

  return null;
}
