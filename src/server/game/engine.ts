import type { PublicLockDto, RunDto } from "@/api/contracts";
import { evaluateMove } from "@/game/apply-move";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { createLock } from "@/game/create-lock";
import { createRun } from "@/game/create-run";
import {
  getDifficultyBand,
  getDifficultyForChest,
} from "@/game/progress-difficulty";
import { cloneLockState, resetCurrentLock } from "@/game/reset-lock";
import { getDeterministicOre, getLockpickReward } from "@/game/rewards";
import { RULESET_VERSION } from "@/game/ruleset";
import type { Direction } from "@/game/types";
import { GameError } from "./errors";
import { emptyMetrics, type StoredRun } from "./types";

export { RULESET_VERSION } from "@/game/ruleset";
export function newRun(
  id: string,
  ownerId: string,
  now = new Date(),
): StoredRun {
  const state = createRun();
  return {
    id,
    ownerId,
    version: 1,
    status: "playing",
    rulesetVersion: RULESET_VERSION,
    createdAt: now,
    updatedAt: now,
    game: {
      state,
      initialLock: cloneLockState(state.currentLock),
      reward: null,
      openedChests: 0,
      chestMetrics: emptyMetrics(),
      totalMetrics: emptyMetrics(),
      finishedAt: null,
    },
  };
}
export function publicRun(run: StoredRun): RunDto {
  const { state, reward, openedChests, finishedAt } = run.game;
  const base = {
    id: run.id,
    version: run.version,
    rulesetVersion: run.rulesetVersion,
    chestIndex: state.chestIndex,
    openedChests,
    oreNuggets: state.oreNuggets,
    lockpicks: state.lockpicks,
    difficulty: getDifficultyBand(state.chestIndex - 1),
    currentLock: {
      pins: state.currentLock.pins.map((pin) => ({ ...pin })),
      invalidMovesOnCurrentPick: state.currentLock.invalidMovesOnCurrentPick,
      maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
      moveRules: state.currentLock.rules.map((rule) => ({
        ...rule,
        effects: rule.effects.map((effect) => ({ ...effect })),
      })),
    } satisfies PublicLockDto,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
  switch (run.status) {
    case "chest_opened":
      if (!reward) throw new Error("Missing reward");
      return { ...base, status: run.status, reward, result: null };
    case "finished":
      if (!finishedAt) throw new Error("Missing finish time");
      return {
        ...base,
        status: run.status,
        reward: null,
        result: {
          totalMetrics: { ...run.game.totalMetrics },
          oreNuggets: state.oreNuggets,
          openedChests,
          finishedAt,
          reason: "lockpicks_exhausted",
        },
      };
    default:
      return { ...base, status: run.status, reward: null, result: null };
  }
}
function abandonRun(run: StoredRun) {
  const game = run.game;
  run.status = "abandoned";
  game.reward = null;
}
function continueRun(run: StoredRun) {
  const game = run.game;
  if (!game.reward) throw new Error("Missing reward");
  const claimedReward = game.reward;
  const nextIndex = game.state.chestIndex + 1;
  const lock = createLock(getDifficultyForChest(nextIndex - 1));
  lock.invalidMovesOnCurrentPick =
    game.state.currentLock.invalidMovesOnCurrentPick;
  game.state = {
    chestIndex: nextIndex,
    oreNuggets: game.state.oreNuggets + claimedReward.oreNuggets,
    lockpicks: game.state.lockpicks + claimedReward.lockpicks,
    currentLock: lock,
  };
  game.initialLock = cloneLockState(lock);
  game.chestMetrics = emptyMetrics();
  game.reward = null;
  run.status = "playing";
}
function moveRun(
  run: StoredRun,
  input: { pinId?: number; direction?: Direction },
  now: Date,
) {
  const game = run.game;
  const { pinId, direction } = input;
  if (
    pinId === undefined ||
    direction === undefined ||
    !game.state.currentLock.pins.some((pin) => pin.id === pinId)
  )
    throw new GameError("INVALID_PIN", 400);
  const result = evaluateMove(game.state, pinId, direction);
  if (result.kind === "ignored") throw new GameError("INVALID_PIN", 400);
  const before = game.state;
  game.state = result.run;
  for (const metrics of [game.chestMetrics, game.totalMetrics]) {
    metrics.moves++;
    if (result.kind === "invalid") metrics.invalidMoves++;
    if (game.state.lockpicks < before.lockpicks) metrics.brokenPicks++;
  }
  if (game.state.currentLock.isFailed) {
    run.status = "finished";
    game.finishedAt = now.toISOString();
  } else if (game.state.currentLock.isSolved) {
    run.status = "chest_opened";
    game.openedChests++;
    game.reward = {
      lockpicks: getLockpickReward(Math.random, run.rulesetVersion),
      oreNuggets: getDeterministicOre(
        game.state.chestIndex,
        game.chestMetrics.invalidMoves,
      ),
    };
  }
}
export type Action = "move" | "reset" | "continue" | "abandon";
export function transition(
  previous: StoredRun,
  action: Action,
  input: { pinId?: number; direction?: Direction },
  now = new Date(),
) {
  const run = structuredClone(previous);
  const game = run.game;
  const conflict = () =>
    new GameError("INVALID_RUN_STATUS", 409, publicRun(previous));
  switch (action) {
    case "abandon":
      if (run.status !== "playing" && run.status !== "chest_opened")
        throw conflict();
      abandonRun(run);
      break;
    case "continue":
      if (run.status !== "chest_opened" || !game.reward) throw conflict();
      continueRun(run);
      break;
    case "reset":
      if (run.status !== "playing") throw conflict();
      game.state = resetCurrentLock(game.state, game.initialLock);
      break;
    case "move":
      if (run.status !== "playing") throw conflict();
      moveRun(run, input, now);
      break;
  }
  run.version++;
  run.updatedAt = now;
  const outcome = actionOutcome(action, run, previous);
  return {
    run,
    response: {
      run: publicRun(run),
      outcome,
      ...(action === "continue" && previous.game.reward
        ? { claimedReward: previous.game.reward }
        : {}),
    },
  };
}

function actionOutcome(action: Action, run: StoredRun, previous: StoredRun) {
  const game = run.game;
  switch (action) {
    case "reset":
      return "lock_reset";
    case "continue":
      return "chest_continued";
    case "abandon":
      return "run_abandoned";
    case "move":
      if (run.status === "finished") return "run_finished";
      if (run.status === "chest_opened") return "chest_opened";
      if (game.state.lockpicks < previous.game.state.lockpicks)
        return "pick_broken";
      if (
        game.chestMetrics.invalidMoves > previous.game.chestMetrics.invalidMoves
      )
        return "invalid_move";
      return "moved";
  }
}
