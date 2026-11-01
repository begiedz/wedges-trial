import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { failureReason } from "./diagnostics";
import type { Action } from "./engine";
import { GameError } from "./errors";
import {
  bootstrap,
  execute,
  findSession,
  readRun,
  SESSION_SECONDS,
} from "./service";

export const COOKIE_NAME = "wedges_session";
export { checkOrigin, isUuid, validateCommand } from "./validation";

import { checkOrigin, isUuid, validateCommand } from "./validation";

async function boundedJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new GameError("INVALID_REQUEST", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError("INVALID_REQUEST", 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) {
        await reader.cancel();
        throw new GameError("INVALID_REQUEST", 400);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GameError("INVALID_REQUEST", 400);
  }
}
export async function handle(
  request: NextRequest,
  operation: Action | "create" | "read" | "session",
  id?: string,
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (new URL(request.url).search)
      throw new GameError("INVALID_REQUEST", 400);
    if (request.method === "POST") checkOrigin(request);
    if (operation === "session") {
      const body = await boundedJson(request);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length
      )
        throw new GameError("INVALID_REQUEST", 400);
      const session = await bootstrap(request.cookies.get(COOKIE_NAME)?.value);
      const response = NextResponse.json({ ready: true }, { headers });
      if (session.token)
        response.cookies.set(COOKIE_NAME, session.token, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: SESSION_SECONDS,
        });
      return response;
    }
    const session = await findSession(request.cookies.get(COOKIE_NAME)?.value);
    if (!session) throw new GameError("SESSION_REQUIRED", 401);
    if (id !== undefined && !isUuid(id))
      throw new GameError("INVALID_REQUEST", 400);
    if (operation === "read")
      return NextResponse.json(
        { run: await readRun(session.id, id) },
        { headers },
      );
    const input = validateCommand(await boundedJson(request), operation);
    const result = await execute(session.id, operation, id, input);
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (error) {
    const known = error instanceof GameError;
    const code = known ? error.code : "SERVICE_UNAVAILABLE";
    const requestId = randomUUID();
    if (!known)
      console.error(
        JSON.stringify({
          event: "game_api_failure",
          requestId,
          operation,
          reason: failureReason(error),
          databaseConfigured: Boolean(
            process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
          ),
        }),
      );
    return NextResponse.json(
      {
        error: {
          code,
          requestId,
          ...(known && error.run
            ? {
                runId: error.run.id,
                currentVersion: error.run.version,
                currentStatus: error.run.status,
              }
            : {}),
        },
      },
      { status: known ? error.status : 503, headers },
    );
  }
}
