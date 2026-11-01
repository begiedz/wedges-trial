import type { RunStatus } from "@/api/contracts";
import type { ChestReward, LockState, RunState } from "@/game/types";

export type Metrics = {
  moves: number;
  invalidMoves: number;
  brokenPicks: number;
};
export type StoredGame = {
  state: RunState;
  initialLock: LockState;
  reward: ChestReward | null;
  openedChests: number;
  chestMetrics: Metrics;
  totalMetrics: Metrics;
  finishedAt: string | null;
};
export type StoredRun = {
  id: string;
  ownerId: string;
  version: number;
  status: RunStatus;
  rulesetVersion: string;
  game: StoredGame;
  createdAt: Date;
  updatedAt: Date;
};
export const emptyMetrics = (): Metrics => ({
  moves: 0,
  invalidMoves: 0,
  brokenPicks: 0,
});
