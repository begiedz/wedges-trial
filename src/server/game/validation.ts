import type { Action } from "./engine";
import { GameError } from "./errors";
import type { Command } from "./service";
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
