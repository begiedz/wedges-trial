import { checkSolved } from "@/game/checkSolved";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { generateRules } from "@/game/generateRules";
import type {
  DifficultyConfig,
  LockMove,
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

function pickRandomRule(
  rules: MoveRule[],
  random: RandomSource,
  previousMove?: LockMove,
): MoveRule | undefined {
  const candidates = [...rules];

  while (candidates.length > 0) {
    const index = Math.floor(random() * candidates.length);
    const [candidate] = candidates.splice(index, 1);

    if (
      previousMove &&
      previousMove.pinId === candidate.sourcePinId &&
      previousMove.direction === (candidate.direction === 1 ? -1 : 1)
    ) {
      continue;
    }

    return candidate;
  }

  return undefined;
}

export function createLock(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): LockState {
  const solvedPins = createSolvedPins(config);
  const rules = generateRules(config, random);
  let mixedPins = clonePins(solvedPins);
  let appliedMoves = 0;
  let attempts = 0;
  let previousMove: LockMove | undefined;

  while (
    (appliedMoves < config.guaranteedSolvableMoves ||
      checkSolved({ pins: mixedPins })) &&
    attempts < config.guaranteedSolvableMoves * 40
  ) {
    const rule = pickRandomRule(rules, random, previousMove);

    if (!rule) {
      attempts += 1;
      continue;
    }

    const nextPins = tryApplyRule(mixedPins, rule);
    attempts += 1;

    if (!nextPins) {
      continue;
    }

    mixedPins = nextPins;
    appliedMoves += 1;
    previousMove = {
      pinId: rule.sourcePinId,
      direction: rule.direction,
    };
  }

  if (checkSolved({ pins: mixedPins })) {
    for (const rule of rules) {
      const nextPins = tryApplyRule(mixedPins, rule);

      if (nextPins && !checkSolved({ pins: nextPins })) {
        mixedPins = nextPins;
        break;
      }
    }
  }

  return {
    pins: mixedPins,
    rules,
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
    isSolved: false,
    isFailed: false,
  };
}
