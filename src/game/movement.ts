import type { MoveRule, Pin } from "./types";

/** Evaluate effects atomically, without runtime solved/failed guards (also used by generation). */
export function evaluateRule(
  pins: Pin[],
  rule: MoveRule,
): { kind: "valid" | "invalid" | "ignored"; pins: Pin[] } {
  const nextPositions = new Map<number, number>();

  for (const pin of pins) {
    nextPositions.set(pin.id, pin.position);
  }

  for (const effect of rule.effects) {
    const currentPosition = nextPositions.get(effect.pinId);

    if (currentPosition === undefined) {
      return { kind: "ignored", pins };
    }

    nextPositions.set(effect.pinId, currentPosition + effect.delta);
  }

  const hasOutOfBoundsPin = pins.some((pin) => {
    const nextPosition = nextPositions.get(pin.id) ?? pin.position;
    return nextPosition < pin.min || nextPosition > pin.max;
  });

  if (hasOutOfBoundsPin) {
    return { kind: "invalid", pins };
  }

  const nextPins = pins.map((pin) => ({
    ...pin,
    position: nextPositions.get(pin.id) ?? pin.position,
  }));
  return { kind: "valid", pins: nextPins };
}
