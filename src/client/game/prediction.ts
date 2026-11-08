import type { RunDto } from "@/api/contracts";
import type { SocketCommand } from "@/api/realtime";
import { applyMove } from "@/game/apply-move";
import type { LockState, RunState } from "@/game/types";

export type Prediction = { run: RunDto; terminal: boolean };
/** Rendering-only prediction. Confirmed resources/status/rewards always come from the server. */
export function predictRun(
  confirmed: RunDto,
  inputs: SocketCommand[],
): Prediction {
  if (confirmed.status !== "playing" || !confirmed.currentLock.moveRules)
    return { run: confirmed, terminal: confirmed.status !== "playing" };
  const lock: LockState = {
    ...confirmed.currentLock,
    pins: confirmed.currentLock.pins.map((pin) => ({ ...pin })),
    rules: confirmed.currentLock.moveRules,
    isSolved: false,
    isFailed: false,
  };
  let state: RunState = {
    chestIndex: confirmed.chestIndex,
    oreNuggets: confirmed.oreNuggets,
    lockpicks: confirmed.lockpicks,
    currentLock: lock,
  };
  for (const input of inputs) {
    if (
      input.action !== "move" ||
      state.currentLock.isSolved ||
      state.currentLock.isFailed
    )
      break;
    const { pinId, direction } = input.body;
    if (pinId === undefined || direction === undefined) break;
    state = applyMove(state, pinId, direction);
  }
  return {
    run: {
      ...confirmed,
      currentLock: {
        ...confirmed.currentLock,
        pins: state.currentLock.pins,
        invalidMovesOnCurrentPick: state.currentLock.invalidMovesOnCurrentPick,
      },
    },
    terminal: state.currentLock.isSolved || state.currentLock.isFailed,
  };
}
