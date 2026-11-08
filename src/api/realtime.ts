import type { Direction } from "@/game/types";
import type { ApiErrorResponse, RunDto } from "./contracts";
export type SocketCommand = {
  type: "action";
  runId: string;
  action: "move" | "reset" | "continue" | "abandon";
  body: {
    actionId: string;
    expectedVersion: number;
    pinId?: number;
    direction?: Direction;
  };
};
export type GameReply = {
  run: RunDto;
  outcome: string;
  claimedReward?: import("@/game/types").ChestReward;
};
export type SocketReply =
  | { type: "ready"; run: RunDto }
  | { type: "result"; actionId: string; response: GameReply }
  | {
      type: "error";
      actionId?: string;
      status: number;
      error: ApiErrorResponse["error"];
    }
  | { type: "ping" };
