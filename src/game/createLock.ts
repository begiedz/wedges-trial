import { checkSolved } from "@/game/checkSolved";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { generateRules } from "@/game/generateRules";
import { solveLock } from "@/game/solver";
import type {
  DifficultyConfig,
  LockState,
  MoveRule,
  Pin,
  RandomSource,
} from "@/game/types";

function clonePins(pins: Pin[]): Pin[] {
  return pins.map((pin) => ({ ...pin }));
}

function createSolvedPins(config: DifficultyConfig): Pin[] {
  return Array.from({ length: config.tumblerCount }, (_, id) => ({
    id,
    min: config.minPosition,
    max: config.maxPosition,
    target: config.targetPosition,
    position: config.targetPosition,
  }));
}

function tryApplyRule(pins: Pin[], rule: MoveRule): Pin[] | null {
  const nextPositions = new Map(pins.map((pin) => [pin.id, pin.position]));

  for (const effect of rule.effects) {
    const currentPosition = nextPositions.get(effect.pinId);

    if (currentPosition === undefined) {
      return null;
    }

    nextPositions.set(effect.pinId, currentPosition + effect.delta);
  }

  const nextPins = pins.map((pin) => ({
    ...pin,
    position: nextPositions.get(pin.id) ?? pin.position,
  }));

  if (
    nextPins.some((pin) => pin.position < pin.min || pin.position > pin.max)
  ) {
    return null;
  }

  return nextPins;
}

function createMixedLock(
  config: DifficultyConfig,
  mixingMoves: number,
  maxSolutionLength: number,
  random: RandomSource,
): { lock: LockState; boundedLock: LockState } {
  const solvedPins = createSolvedPins(config);
  const rules = generateRules(config, random);
  let mixedPins = clonePins(solvedPins);
  let boundedPins = mixedPins;
  const visited = new Set([mixedPins.map((pin) => pin.position).join(",")]);

  for (let move = 0; move < mixingMoves; move += 1) {
    const candidates = rules
      .map((rule) => tryApplyRule(mixedPins, rule))
      .filter(
        (pins): pins is Pin[] =>
          pins !== null &&
          !visited.has(pins.map((pin) => pin.position).join(",")),
      );
    if (candidates.length === 0) {
      break;
    }
    mixedPins = candidates[Math.floor(random() * candidates.length)];
    if (move < maxSolutionLength) {
      boundedPins = mixedPins;
    }
    // Avoid cancelling earlier mixing moves, not just the immediately previous one.
    visited.add(mixedPins.map((pin) => pin.position).join(","));
  }

  if (checkSolved({ pins: mixedPins })) {
    throw new RangeError("Lock configuration has no valid mixing move");
  }

  const lock: LockState = {
    pins: mixedPins,
    rules,
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
    isSolved: false,
    isFailed: false,
  };
  return { lock, boundedLock: { ...lock, pins: boundedPins } };
}

export function createLock(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): LockState {
  const minLength = Math.max(1, config.minSolutionLength ?? 1);
  const maxLength = Math.max(
    1,
    config.maxSolutionLength ?? config.guaranteedSolvableMoves,
  );
  // Longer walks counter shortcuts. Keep an early snapshot whose inverse path
  // satisfies the upper bound if the solver exhausts its search budget.
  const mixingMoves = Math.max(1, config.guaranteedSolvableMoves) * 4;
  const firstCandidate = createMixedLock(
    config,
    mixingMoves,
    maxLength,
    random,
  );
  let bestLock = firstCandidate.boundedLock;
  let bestLength = -1;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { lock } =
      attempt === 0
        ? firstCandidate
        : createMixedLock(config, mixingMoves, maxLength, random);
    const solution = solveLock(lock);
    if (solution && solution.length >= minLength && minLength <= maxLength) {
      // Following a shortest path preserves shortest distance for its suffix.
      let pins = lock.pins;
      for (const move of solution.slice(
        0,
        Math.max(0, solution.length - maxLength),
      )) {
        const rule = lock.rules.find(
          (rule) =>
            rule.sourcePinId === move.pinId &&
            rule.direction === move.direction,
        );
        if (rule) {
          pins = tryApplyRule(pins, rule) ?? pins;
        }
      }
      return { ...lock, pins };
    }
    if (
      solution &&
      solution.length <= maxLength &&
      solution.length > bestLength
    ) {
      bestLock = lock;
      bestLength = solution.length;
    }
  }

  // Fixed pin ranges can make late targets unreachable. Preserve construction
  // solvability instead of retrying forever or treating BFS exhaustion as failure.
  return bestLock;
}
