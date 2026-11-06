import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { failureReason } from "@/server/game/diagnostics";
import { GameError } from "@/server/game/errors";
import { readLeaderboard } from "./pagination";

export async function handleLeaderboard(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    return NextResponse.json(
      await readLeaderboard(new URL(request.url).searchParams),
      { headers },
    );
  } catch (error) {
    const known = error instanceof GameError;
    const requestId = randomUUID();
    if (!known)
      console.error(
        JSON.stringify({
          event: "leaderboard_api_failure",
          requestId,
          reason: failureReason(error),
        }),
      );
    return NextResponse.json(
      {
        error: {
          code: known ? error.code : "SERVICE_UNAVAILABLE",
          requestId,
        },
      },
      { status: known ? error.status : 503, headers },
    );
  }
}
