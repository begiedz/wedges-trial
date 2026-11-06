import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { failureReason } from "@/server/game/diagnostics";
import { GameError } from "@/server/game/errors";
import { readLeaderboard } from "./pagination";
import { LeaderboardRateLimitError, limitLeaderboard } from "./rate-limit";

export async function handleLeaderboard(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  try {
    await limitLeaderboard({
      operation: new URL(request.url).searchParams.has("cursor")
        ? "page"
        : "snapshot",
    });
    return NextResponse.json(
      await readLeaderboard(new URL(request.url).searchParams),
      { headers },
    );
  } catch (error) {
    if (error instanceof LeaderboardRateLimitError)
      headers["Retry-After"] = String(error.retryAfter);
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
