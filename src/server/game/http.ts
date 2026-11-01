import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { failureReason } from "./diagnostics";
import type { Action } from "./engine";
import { GameError } from "./errors";
import {
  bootstrap,
  type Command,
  execute,
  findSession,
  readRun,
  SESSION_SECONDS,
} from "./service";

export const COOKIE_NAME = "wedges_session";
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new GameError("ORIGIN_FORBIDDEN", 403);
}
export function validateCommand(
  value: unknown,
  action: Action | "create",
): Command {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GameError("INVALID_REQUEST", 400);
  const body = value as Record<string, unknown>;
  const keys =
    action === "create"
      ? ["actionId"]
      : action === "move"
        ? ["actionId", "expectedVersion", "pinId", "direction"]
        : ["actionId", "expectedVersion"];
  if (
    Object.keys(body).length !== keys.length ||
    keys.some((key) => !(key in body)) ||
    Object.keys(body).some((key) => !keys.includes(key)) ||
    !isUuid(body.actionId)
  )
    throw new GameError("INVALID_REQUEST", 400);
  if (
    action !== "create" &&
    (!Number.isSafeInteger(body.expectedVersion) ||
      (body.expectedVersion as number) < 1)
  )
    throw new GameError("INVALID_REQUEST", 400);
  if (
    action === "move" &&
    (!Number.isSafeInteger(body.pinId) ||
      (body.pinId as number) < 0 ||
      (body.direction !== -1 && body.direction !== 1))
  )
    throw new GameError("INVALID_REQUEST", 400);
  return body as Command;
}
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
