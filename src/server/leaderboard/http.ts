import { NextResponse } from "next/server";
import { failureReason } from "@/server/game/diagnostics";
import { publicError } from "@/server/game/errors";
import { readLeaderboard } from "./pagination";
import { LeaderboardRateLimitError, limitLeaderboard } from "./rate-limit";

export async function handleLeaderboard(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  try {
    await limitLeaderboard({ operation: "page" });
    return NextResponse.json(
      await readLeaderboard(new URL(request.url).searchParams),
      { headers },
    );
  } catch (error) {
    if (error instanceof LeaderboardRateLimitError)
      headers["Retry-After"] = String(error.retryAfter);
    const failure = publicError(error);
    const { requestId } = failure.body.error;
    if (!failure.known)
      console.error(
        JSON.stringify({
          event: "leaderboard_api_failure",
          requestId,
          reason: failureReason(error),
        }),
      );
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers,
    });
  }
}
