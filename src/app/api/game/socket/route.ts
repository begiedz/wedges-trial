import { randomUUID } from "node:crypto";
import { upgradeWebSocket } from "@vercel/functions";
import { type NextRequest, NextResponse } from "next/server";
import { GameError } from "@/server/game/errors";
import { COOKIE_NAME } from "@/server/game/http";
import { findSession, readRun } from "@/server/game/service";
import { bindGameSocket, isUuid } from "@/server/game/socket";
import { checkOrigin } from "@/server/game/validation";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  try {
    checkOrigin(request);
    const params = request.nextUrl.searchParams;
    const runId = params.get("run");
    if (
      !isUuid(runId) ||
      params.size !== 1 ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    )
      throw new GameError("INVALID_REQUEST", 400);
    const session = await findSession(request.cookies.get(COOKIE_NAME)?.value);
    if (!session) throw new GameError("SESSION_REQUIRED", 401);
    await readRun(session.id, runId);
    return await upgradeWebSocket(
      (ws) => bindGameSocket(ws, session.id, runId, session.expiresAt),
      { maxPayload: 2048 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: error instanceof GameError ? error.code : "SERVICE_UNAVAILABLE",
          requestId: randomUUID(),
        },
      },
      {
        status: error instanceof GameError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
