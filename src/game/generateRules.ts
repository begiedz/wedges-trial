import type {
  DifficultyConfig,
  Direction,
  MoveRule,
  PinEffect,
  RandomSource,
} from "@/game/types";

function createSelfEffect(pinId: number, direction: Direction): PinEffect {
  return {
    pinId,
    delta: direction,
  };
}

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

export function generateRules(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): MoveRule[] {
  const rules: MoveRule[] = [];
  const pinIds = Array.from({ length: config.pinCount }, (_, index) => index);
  const secondaryBudget = Math.round(
    Math.max(0, config.pinCount - 1) * config.dependencyDensity,
  );

  for (const sourcePinId of pinIds) {
    const candidatePins = shuffle(
      pinIds.filter((pinId) => pinId !== sourcePinId),
      random,
    );
    const secondaryEffects = candidatePins
      .slice(0, secondaryBudget)
      .map((pinId) => ({
        pinId,
        delta: random() < 0.5 ? -1 : 1,
      })) satisfies PinEffect[];

    const rightEffects = [
      createSelfEffect(sourcePinId, 1),
      ...secondaryEffects,
    ];
    const leftEffects = rightEffects.map((effect) => ({
      pinId: effect.pinId,
      delta: effect.delta === 1 ? -1 : 1,
    })) satisfies PinEffect[];

    rules.push({
      sourcePinId,
      direction: 1,
      effects: rightEffects,
    });
    rules.push({
      sourcePinId,
      direction: -1,
      effects: leftEffects,
    });
  }

  return rules;
}
