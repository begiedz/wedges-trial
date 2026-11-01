import { randomUUID } from "node:crypto";
import type { ApiErrorResponse, MoveRequest } from "@/api/contracts";
import type { SocketCommand, SocketReply } from "@/api/realtime";
import { failureReason } from "./diagnostics";
import { GameError } from "./errors";
import { executeMoveBatch } from "./moveBatch";
import { execute, readRun } from "./service";
import { isUuid, validateCommand } from "./validation";

/** Minimal socket interface shared by Vercel and protocol tests. */
export interface GameSocket {
  readyState: number;
  bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(
    event: "message",
    callback: (data: { toString(): string }, isBinary: boolean) => void,
  ): unknown;
  on(event: "close" | "error", callback: () => void): unknown;
}
function errorReply(error: unknown, actionId?: string): SocketReply {
  const requestId = randomUUID();
  const known = error instanceof GameError;
  if (!known)
    console.error(
      JSON.stringify({
        event: "game_socket_failure",
        requestId,
        reason: failureReason(error),
      }),
    );
  const body: ApiErrorResponse["error"] = {
    code: known ? error.code : "SERVICE_UNAVAILABLE",
    requestId,
  };
  if (known && error.run)
    Object.assign(body, {
      runId: error.run.id,
      currentVersion: error.run.version,
      currentStatus: error.run.status,
    });
  return {
    type: "error",
    actionId,
    status: known ? error.status : 503,
    error: body,
  };
}
export function parseSocketCommand(
  value: unknown,
  runId: string,
): SocketCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GameError("INVALID_REQUEST", 400);
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== 4 ||
    data.type !== "action" ||
    data.runId !== runId ||
    !["move", "reset", "continue", "abandon"].includes(String(data.action))
  )
    throw new GameError("INVALID_REQUEST", 400);
  const action = data.action as SocketCommand["action"];
  const body = validateCommand(data.body, action);
  return { type: "action", runId, action, body: body as SocketCommand["body"] };
}
export async function bindGameSocket(
  socket: GameSocket,
  ownerId: string,
  runId: string,
  expiresAt: Date,
) {
  let closed = false;
  let draining = false;
  let queued: SocketCommand[] = [];
  let received = 0;
  let rateWindow = Date.now();
  let lastPong = Date.now();
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const send = (reply: SocketReply) => {
    if (closed || socket.readyState !== 1) return;
    if (socket.bufferedAmount > 256 * 1024) {
      socket.close(1013, "Slow consumer");
      return;
    }
    socket.send(JSON.stringify(reply));
  };
  const drain = async () => {
    scheduled = undefined;
    if (draining || closed || !queued.length) return;
    draining = true;
    const first = queued[0];
    const count =
      first.action === "move"
        ? Math.min(
            32,
            queued.findIndex((x) => x.action !== "move") < 0
              ? queued.length
              : queued.findIndex((x) => x.action !== "move"),
          )
        : 1;
    const batch = queued.splice(0, count);
    try {
      if (expiresAt.getTime() <= Date.now())
        throw new GameError("SESSION_REQUIRED", 401);
      if (first.action === "move") {
        const results = await executeMoveBatch(
          ownerId,
          runId,
          batch.map((x) => x.body as MoveRequest),
        );
        for (const result of results)
          send(
            "failure" in result
              ? errorReply(result.failure, result.actionId)
              : {
                  type: "result",
                  actionId: result.actionId,
                  response: result.response,
                },
          );
      } else {
        const result = await execute(ownerId, first.action, runId, first.body);
        send({
          type: "result",
          actionId: first.body.actionId,
          response: result.body,
        });
      }
    } catch (error) {
      for (const command of batch)
        send(errorReply(error, command.body.actionId));
    } finally {
      draining = false;
      if (!closed && queued.length)
        scheduled = setTimeout(() => void drain(), 0);
    }
  };
  socket.on("message", (raw, binary) => {
    if (closed) return;
    const text = raw.toString();
    if (binary || Buffer.byteLength(text) > 2048) {
      socket.close(1009, "Message too large");
      return;
    }
    if (Date.now() - rateWindow >= 1000) {
      received = 0;
      rateWindow = Date.now();
    }
    if (++received > 120 || queued.length >= 128) {
      socket.close(1008, "Input limit exceeded");
      return;
    }
    try {
      const value = JSON.parse(text);
      if (value?.type === "pong" && Object.keys(value).length === 1) {
        lastPong = Date.now();
        return;
      }
      const command = parseSocketCommand(value, runId);
      queued.push(command);
      if (!scheduled && !draining)
        scheduled = setTimeout(() => void drain(), 4);
    } catch (error) {
      send(
        errorReply(
          error instanceof GameError
            ? error
            : new GameError("INVALID_REQUEST", 400),
        ),
      );
    }
  });
  const heartbeat = setInterval(() => {
    if (Date.now() >= expiresAt.getTime() || Date.now() - lastPong > 60000)
      socket.close(4001, "Reconnect required");
    else send({ type: "ping" });
  }, 20000);
  const cleanup = () => {
    closed = true;
    queued = [];
    clearInterval(heartbeat);
    if (scheduled) clearTimeout(scheduled);
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);
  try {
    const run = await readRun(ownerId, runId);
    if (!run) throw new GameError("RUN_NOT_FOUND", 404);
    send({ type: "ready", run });
  } catch (error) {
    send(errorReply(error));
    socket.close(1008, "Run unavailable");
  }
}
export { isUuid };
