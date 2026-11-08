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

function getSecondaryEffectCount(
  plateCount: number,
  density: number,
  random: RandomSource,
): number {
  const expected = Math.max(0, plateCount - 1) * density;
  const whole = Math.floor(expected);
  // Stochastic rounding preserves fractional density across individual rules.
  return whole + (random() < expected - whole ? 1 : 0);
}

export function generateRules(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): MoveRule[] {
  if (config.topology) return generateTopologyRules(config, random);
  const rules: MoveRule[] = [];
  const pinIds = Array.from({ length: config.plateCount }, (_, index) => index);
  for (const sourcePinId of pinIds) {
    const secondaryBudget = getSecondaryEffectCount(
      config.plateCount,
      config.dependencyDensity,
      random,
    );
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

function generateTopologyRules(
  config: DifficultyConfig,
  random: RandomSource,
): MoveRule[] {
  const topology = config.topology;
  if (!topology) throw new Error("Missing topology");
  const { coreSize, dependencies, maxFanout, sameDirectionOnly } = topology;
  if (
    !Number.isInteger(coreSize) ||
    coreSize < 2 ||
    coreSize > config.plateCount ||
    !Number.isInteger(maxFanout) ||
    maxFanout < 1 ||
    maxFanout >= coreSize ||
    !Number.isInteger(dependencies) ||
    dependencies < coreSize - 1 ||
    dependencies > coreSize * maxFanout
  )
    throw new RangeError("Invalid topology budget");
  const ids = Array.from({ length: config.plateCount }, (_, id) => id);
  // Saved cohorts restrict core membership to a prefix. New runs sample all
  // visible plates without favoring the beginning of the lock.
  const core = shuffle(
    config.mixAllPlates ? ids : ids.slice(0, Math.max(4, coreSize)),
    random,
  ).slice(0, coreSize);
  const targets = new Map(ids.map((id) => [id, new Set<number>()]));
  // A directed chain connects the core without exceeding one outgoing edge.
  for (let i = 1; i < core.length; i++) targets.get(core[i - 1])?.add(core[i]);
  let remaining = dependencies - (coreSize - 1);
  const candidates = shuffle(
    core.flatMap((source) =>
      core
        .filter((target) => source !== target)
        .map((target) => [source, target] as const),
    ),
    random,
  );
  for (const [source, target] of candidates) {
    const outgoing = targets.get(source);
    if (!remaining) break;
    if (!outgoing || outgoing.has(target) || outgoing.size >= maxFanout)
      continue;
    outgoing.add(target);
    remaining--;
  }
  if (remaining) throw new Error("Unable to fill topology budget");
  return ids.flatMap((sourcePinId) => {
    const effects: PinEffect[] = [
      createSelfEffect(sourcePinId, 1),
      ...Array.from(
        targets.get(sourcePinId) ?? [],
        (pinId): PinEffect => ({
          pinId,
          delta: sameDirectionOnly || random() >= 0.5 ? 1 : -1,
        }),
      ),
    ];
    return [
      { sourcePinId, direction: 1 as const, effects },
      {
        sourcePinId,
        direction: -1 as const,
        effects: effects.map(
          (effect): PinEffect => ({
            pinId: effect.pinId,
            delta: effect.delta === 1 ? -1 : 1,
          }),
        ),
      },
    ];
  });
}
