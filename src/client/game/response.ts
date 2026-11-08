import type { RunDto } from "@/api/contracts";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min;
const date = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const reward = (value: unknown) =>
  object(value) && integer(value.oreNuggets) && integer(value.lockpicks);

/** Validate everything consumed by rendering/prediction before publishing an HTTP snapshot. */
export function isRunDto(value: unknown): value is RunDto {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !integer(value.version, 1) ||
    typeof value.rulesetVersion !== "string" ||
    !integer(value.chestIndex, 1) ||
    !integer(value.openedChests) ||
    !integer(value.oreNuggets) ||
    !integer(value.lockpicks) ||
    !integer(value.difficulty, 1) ||
    value.difficulty > 4 ||
    !date(value.createdAt) ||
    !date(value.updatedAt)
  )
    return false;
  const lock = value.currentLock;
  if (
    !object(lock) ||
    lock.maxInvalidMovesPerPick !== MAX_INVALID_MOVES_PER_PICK ||
    !integer(lock.invalidMovesOnCurrentPick) ||
    lock.invalidMovesOnCurrentPick >= MAX_INVALID_MOVES_PER_PICK ||
    !Array.isArray(lock.pins)
  )
    return false;
  if (
    !lock.pins.every(
      (pin: unknown) =>
        object(pin) &&
        integer(pin.id) &&
        typeof pin.min === "number" &&
        Number.isSafeInteger(pin.min) &&
        typeof pin.max === "number" &&
        Number.isSafeInteger(pin.max) &&
        integer(pin.position, pin.min) &&
        pin.position <= pin.max &&
        integer(pin.target, pin.min) &&
        pin.target <= pin.max,
    )
  )
    return false;
  if (
    lock.moveRules !== undefined &&
    (!Array.isArray(lock.moveRules) ||
      !lock.moveRules.every(
        (rule: unknown) =>
          object(rule) &&
          integer(rule.sourcePinId) &&
          (rule.direction === 1 || rule.direction === -1) &&
          Array.isArray(rule.effects) &&
          rule.effects.every(
            (effect: unknown) =>
              object(effect) &&
              integer(effect.pinId) &&
              (effect.delta === 1 || effect.delta === -1),
          ),
      ))
  )
    return false;
  switch (value.status) {
    case "playing":
    case "abandoned":
      return value.reward === null && value.result === null;
    case "chest_opened":
      return reward(value.reward) && value.result === null;
    case "finished":
      return (
        value.reward === null &&
        object(value.result) &&
        integer(value.result.oreNuggets) &&
        integer(value.result.openedChests) &&
        (value.result.totalMetrics === undefined ||
          (object(value.result.totalMetrics) &&
            integer(value.result.totalMetrics.moves) &&
            integer(value.result.totalMetrics.invalidMoves) &&
            integer(value.result.totalMetrics.brokenPicks))) &&
        date(value.result.finishedAt) &&
        value.result.reason === "lockpicks_exhausted"
      );
    default:
      return false;
  }
}
