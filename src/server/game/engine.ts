import type { RunDto } from "@/api/contracts";
import { applyMove, applyMoveToLock } from "@/game/applyMove";
import { createLock } from "@/game/createLock";
import { createRun } from "@/game/createRun";
import {
  getDifficultyBand,
  getDifficultyForChest,
} from "@/game/progressDifficulty";
import { cloneLockState, resetCurrentLock } from "@/game/resetLock";
import { getChestReward, getDeterministicOre } from "@/game/rewards";
import type { Direction } from "@/game/types";
import { GameError } from "./errors";
import { emptyMetrics, type StoredRun } from "./types";

export const RULESET_VERSION = "deterministic-ore-v1";
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
      maxInvalidMovesPerPick: 3 as const,
    },
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
  if (action === "abandon") {
    if (run.status !== "playing" && run.status !== "chest_opened")
      throw conflict();
    run.status = "abandoned";
    game.reward = null;
  } else if (action === "continue") {
    if (run.status !== "chest_opened" || !game.reward) throw conflict();
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
  } else {
    if (run.status !== "playing") throw conflict();
    if (action === "reset")
      game.state = resetCurrentLock(game.state, game.initialLock);
    else {
      const { pinId, direction } = input;
      if (
        pinId === undefined ||
        direction === undefined ||
        !game.state.currentLock.pins.some((pin) => pin.id === pinId)
      )
        throw new GameError("INVALID_PIN", 400);
      const result = applyMoveToLock(game.state.currentLock, pinId, direction);
      if (result.kind === "ignored") throw new GameError("INVALID_PIN", 400);
      const before = game.state;
      game.state = applyMove(before, pinId, direction);
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
          ...getChestReward(game.state.chestIndex),
          oreNuggets: getDeterministicOre(
            game.state.chestIndex,
            game.chestMetrics.invalidMoves,
          ),
        };
      }
    }
  }
  run.version++;
  run.updatedAt = now;
  const outcome =
    action === "move"
      ? run.status === "finished"
        ? "run_finished"
        : run.status === "chest_opened"
          ? "chest_opened"
          : game.state.lockpicks < previous.game.state.lockpicks
            ? "pick_broken"
            : game.chestMetrics.invalidMoves >
                previous.game.chestMetrics.invalidMoves
              ? "invalid_move"
              : "moved"
      : action === "reset"
        ? "lock_reset"
        : action === "continue"
          ? "chest_continued"
          : "run_abandoned";
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
