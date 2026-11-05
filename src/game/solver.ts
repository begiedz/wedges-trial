import { checkSolved } from "@/game/check-solved";
import { evaluateRule } from "@/game/movement";
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

export const DEFAULT_SOLVER_BUDGET = 20_000;

export type SolveResult =
  | { kind: "found"; solution: LockMove[]; visitedStates: number }
  | { kind: "budget-exhausted" | "unsolvable"; visitedStates: number };

/** Replays every action using gameplay's atomic movement evaluator. */
export function verifySolution(lock: LockState, solution: LockMove[]): boolean {
  let pins = lock.pins;
  for (const move of solution) {
    if (checkSolved({ pins })) return false;
    const rule = lock.rules.find(
      (rule) =>
        rule.sourcePinId === move.pinId && rule.direction === move.direction,
    );
    if (!rule) return false;
    const result = evaluateRule(pins, rule);
    if (result.kind !== "valid") return false;
    pins = result.pins;
  }
  return checkSolved({ pins });
}

/** Complete BFS layers prove shortest distance; only an exhausted reachable
 * frontier proves unsolvability. Reaching the state cap proves neither.
 */
export function solveLockDetailed(
  lock: LockState,
  maxVisitedStates = DEFAULT_SOLVER_BUDGET,
): SolveResult {
  if (checkSolved(lock)) {
    return { kind: "found", solution: [], visitedStates: 1 };
  }
  if (!Number.isSafeInteger(maxVisitedStates) || maxVisitedStates < 2) {
    return { kind: "budget-exhausted", visitedStates: 0 };
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
          const solution = forward
            ? joinPaths(next, meeting)
            : joinPaths(meeting, next);
          if (!verifySolution(lock, solution)) {
            throw new Error("Solver reconstructed an illegal solution");
          }
          return {
            kind: "found",
            solution,
            visitedStates: forwardVisited.size + backwardVisited.size,
          };
        }
        if (forwardVisited.size + backwardVisited.size >= maxVisitedStates) {
          return {
            kind: "budget-exhausted",
            visitedStates: forwardVisited.size + backwardVisited.size,
          };
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
  return {
    kind: "unsolvable",
    visitedStates: forwardVisited.size + backwardVisited.size,
  };
}

/** Compatibility helper for visual/debug callers. Null never proves unsolvability;
 * generation and diagnostics must inspect solveLockDetailed instead.
 */
export function solveLock(
  lock: LockState,
  maxVisitedStates = DEFAULT_SOLVER_BUDGET,
): LockMove[] | null {
  const result = solveLockDetailed(lock, maxVisitedStates);
  return result.kind === "found" ? result.solution : null;
}
