import { checkSolved } from "@/game/checkSolved";
import type { LockMove, LockState } from "@/game/types";

type SearchNode = {
  positions: number[];
  parent: SearchNode | null;
  move: LockMove | null;
};

function joinPaths(forward: SearchNode, backward: SearchNode): LockMove[] {
  const path: LockMove[] = [];
  for (let node = forward; node.parent && node.move; node = node.parent) {
    path.push(node.move);
  }
  path.reverse();
  for (let node = backward; node.parent && node.move; node = node.parent) {
    path.push(node.move);
  }
  return path;
}

export function solveLock(
  lock: LockState,
  maxVisitedStates = 20_000,
): LockMove[] | null {
  if (checkSolved(lock)) {
    return [];
  }
  if (maxVisitedStates < 2) {
    return null;
  }

  const pinIndices = new Map(lock.pins.map((pin, index) => [pin.id, index]));
  const rules = lock.rules.map((rule) => ({
    move: { pinId: rule.sourcePinId, direction: rule.direction },
    effects: rule.effects.map((effect) => ({
      index: pinIndices.get(effect.pinId),
      delta: effect.delta,
    })),
  }));
  const start: SearchNode = {
    positions: lock.pins.map((pin) => pin.position),
    parent: null,
    move: null,
  };
  const target: SearchNode = {
    positions: lock.pins.map((pin) => pin.target),
    parent: null,
    move: null,
  };
  let forwardFrontier = [start];
  let backwardFrontier = [target];
  const forwardVisited = new Map([[start.positions.join(","), start]]);
  const backwardVisited = new Map([[target.positions.join(","), target]]);

  // Expand complete BFS layers from both ends. Reverse effects also support
  // locks whose rules do not explicitly contain an inverse move.
  while (forwardFrontier.length > 0 && backwardFrontier.length > 0) {
    const forward = forwardFrontier.length <= backwardFrontier.length;
    const frontier = forward ? forwardFrontier : backwardFrontier;
    const visited = forward ? forwardVisited : backwardVisited;
    const otherVisited = forward ? backwardVisited : forwardVisited;
    const nextFrontier: SearchNode[] = [];

    for (const current of frontier) {
      for (const rule of rules) {
        const positions = [...current.positions];
        let valid = true;
        for (const effect of rule.effects) {
          if (effect.index === undefined) {
            valid = false;
            break;
          }
          positions[effect.index] += effect.delta * (forward ? 1 : -1);
        }
        if (
          !valid ||
          positions.some(
            (position, index) =>
              position < lock.pins[index].min ||
              position > lock.pins[index].max,
          )
        ) {
          continue;
        }

        const key = positions.join(",");
        if (visited.has(key)) {
          continue;
        }
        const next: SearchNode = {
          positions,
          parent: current,
          move: rule.move,
        };
        const meeting = otherVisited.get(key);
        if (meeting) {
          return forward ? joinPaths(next, meeting) : joinPaths(meeting, next);
        }
        if (forwardVisited.size + backwardVisited.size >= maxVisitedStates) {
          return null;
        }
        visited.set(key, next);
        nextFrontier.push(next);
      }
    }

    if (forward) {
      forwardFrontier = nextFrontier;
    } else {
      backwardFrontier = nextFrontier;
    }
  }
  return null;
}
