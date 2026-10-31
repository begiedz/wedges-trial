/** Target wire contract for issue #29; no server endpoints are implemented yet. */
import type { ChestReward, Direction, LockDifficulty, Pin } from "@/game/types";

export type RunStatus = "playing" | "chest_opened" | "finished" | "abandoned";

export type StartRunRequest = {
  actionId: string;
};

export type RunActionRequest = {
  actionId: string;
  expectedVersion: number;
};

export type MoveRequest = RunActionRequest & {
  pinId: number;
  direction: Direction;
};

export type PublicLockDto = {
  pins: Pin[];
  invalidMovesOnCurrentPick: number;
  maxInvalidMovesPerPick: 3;
};

export type RunResultDto = {
  oreNuggets: number;
  openedChests: number;
  finishedAt: string;
  reason: "lockpicks_exhausted";
};

type RunDtoBase = {
  id: string;
  version: number;
  rulesetVersion: string;
  chestIndex: number;
  openedChests: number;
  oreNuggets: number;
  lockpicks: number;
  difficulty: LockDifficulty;
  currentLock: PublicLockDto;
  createdAt: string;
  updatedAt: string;
};

export type RunDto = RunDtoBase &
  (
    | { status: "playing"; reward: null; result: null }
    | { status: "chest_opened"; reward: ChestReward; result: null }
    | { status: "finished"; reward: null; result: RunResultDto }
    | { status: "abandoned"; reward: null; result: null }
  );

export type RunResponse = { run: RunDto };
export type CurrentRunResponse = { run: RunDto | null };

export type StartRunResponse = RunResponse & { outcome: "run_started" };
export type MoveResponse = RunResponse & {
  outcome:
    | "moved"
    | "invalid_move"
    | "pick_broken"
    | "chest_opened"
    | "run_finished";
};
export type ResetRunResponse = RunResponse & { outcome: "lock_reset" };
export type ContinueRunResponse = RunResponse & {
  outcome: "chest_continued";
  claimedReward: ChestReward;
};
export type AbandonRunResponse = RunResponse & { outcome: "run_abandoned" };

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_PIN"
  | "INVALID_CURSOR"
  | "SESSION_REQUIRED"
  | "ORIGIN_FORBIDDEN"
  | "RUN_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "ACTION_ID_REUSED"
  | "INVALID_RUN_STATUS"
  | "ACTIVE_RUN_EXISTS"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    requestId: string;
    /** Present only for an owned run's version/status/active-run conflict. */
    runId?: string;
    currentVersion?: number;
    currentStatus?: RunStatus;
    /** Known schema field names only; never echoed request values. */
    fields?: string[];
  };
};

export type LeaderboardQuery = {
  limit?: number;
  cursor?: string;
};

export type LeaderboardEntryDto = {
  rank: number;
  runId: string;
  displayName: string;
  oreNuggets: number;
  openedChests: number;
  finishedAt: string;
};

export type LeaderboardResponse = {
  rulesetVersion: string;
  entries: LeaderboardEntryDto[];
  nextCursor: string | null;
};
