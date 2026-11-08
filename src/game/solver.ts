import { checkSolved } from "@/game/check-solved";
import { evaluateRule } from "@/game/movement";
import type { LockMove, LockState } from "@/game/types";

type SearchKey = number | string;

type SearchNode = {
  key: SearchKey;
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

  // Collision-free mixed-radix keys avoid allocating strings in the BFS hot path.
  // Keep string keys for arbitrary debug configurations exceeding safe integers.
  let states = 1;
  const strides = lock.pins.map((pin) => {
    const stride = states;
    states *= pin.max - pin.min + 1;
    return stride;
  });
  const numericKeys =
    Number.isSafeInteger(states) &&
    states > 0 &&
    lock.pins.every(
      (pin) =>
        Number.isSafeInteger(pin.min) &&
        Number.isSafeInteger(pin.max) &&
        Number.isSafeInteger(pin.position) &&
        Number.isSafeInteger(pin.target) &&
        pin.position >= pin.min &&
        pin.position <= pin.max &&
        pin.target >= pin.min &&
        pin.target <= pin.max,
    );
  const keyFor = (positions: number[]): SearchKey =>
    numericKeys
      ? positions.reduce(
          (key, position, index) =>
            key + (position - lock.pins[index].min) * strides[index],
          0,
        )
      : positions.join(",");
  const pinIndices = new Map(lock.pins.map((pin, index) => [pin.id, index]));
  const rules = lock.rules.map((rule) => {
    // Sum duplicate effects before checking bounds, as the atomic evaluator does.
    const deltas = new Map<number, number>();
    let known = true;
    for (const effect of rule.effects) {
      const index = pinIndices.get(effect.pinId);
      if (index === undefined) {
        known = false;
        break;
      }
      deltas.set(index, (deltas.get(index) ?? 0) + effect.delta);
    }
    const effects = [...deltas].map(([index, delta]) => ({ index, delta }));
    return {
      move: { pinId: rule.sourcePinId, direction: rule.direction },
      known,
      effects,
      keyDelta: effects.reduce(
        (delta, effect) => delta + effect.delta * strides[effect.index],
        0,
      ),
    };
  });
  const start: SearchNode = {
    key: keyFor(lock.pins.map((pin) => pin.position)),
    positions: lock.pins.map((pin) => pin.position),
    parent: null,
    move: null,
  };
  const target: SearchNode = {
    key: keyFor(lock.pins.map((pin) => pin.target)),
    positions: lock.pins.map((pin) => pin.target),
    parent: null,
    move: null,
  };
  let forwardFrontier = [start];
  let backwardFrontier = [target];
  const forwardVisited = new Map<SearchKey, SearchNode>([[start.key, start]]);
  const backwardVisited = new Map<SearchKey, SearchNode>([
    [target.key, target],
  ]);

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
        if (!rule.known) continue;
        const sign = forward ? 1 : -1;
        let key: SearchKey;
        let positions: number[];
        if (numericKeys) {
          // All frontier states are in bounds. Reject illegal/visited neighbors
          // before allocating a new position vector or search node.
          if (
            rule.effects.some(({ index, delta }) => {
              const position = current.positions[index] + delta * sign;
              return (
                position < lock.pins[index].min ||
                position > lock.pins[index].max
              );
            })
          )
            continue;
          key = (current.key as number) + rule.keyDelta * sign;
          if (visited.has(key)) continue;
          positions = [...current.positions];
          for (const effect of rule.effects)
            positions[effect.index] += effect.delta * sign;
        } else {
          positions = [...current.positions];
          for (const effect of rule.effects)
            positions[effect.index] += effect.delta * sign;
          if (
            positions.some(
              (position, index) =>
                position < lock.pins[index].min ||
                position > lock.pins[index].max,
            )
          )
            continue;
          key = keyFor(positions);
          if (visited.has(key)) continue;
        }
        const next: SearchNode = {
          key,
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
