import type { SocketCommand } from "@/api/realtime";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { newRun, publicRun } from "@/server/game/engine";

export function storedRun() {
  const run = newRun(
    "12345678-1234-4234-8234-123456789012",
    "owner",
    new Date(0),
  );
  run.game.state.currentLock = {
    pins: [{ id: 0, position: 0, min: 0, max: 4, target: 4 }],
    rules: [1, -1].map((direction) => ({
      sourcePinId: 0,
      direction: direction as 1 | -1,
      effects: [{ pinId: 0, delta: direction as 1 | -1 }],
    })),
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
    isSolved: false,
    isFailed: false,
  };
  run.game.initialLock = structuredClone(run.game.state.currentLock);
  return run;
}
export const runDto = () => publicRun(storedRun());
export function moveCommand(
  expectedVersion = 1,
  direction: 1 | -1 = 1,
): SocketCommand {
  return {
    type: "action",
    runId: "12345678-1234-4234-8234-123456789012",
    action: "move",
    body: {
      actionId: crypto.randomUUID(),
      expectedVersion,
      pinId: 0,
      direction,
    },
  };
}
