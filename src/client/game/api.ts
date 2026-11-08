import type { RunDto } from "@/api/contracts";
import { isRunDto } from "./response";

export class TransportError extends Error {
  constructor(public status: number) {
    super("REQUEST_FAILED");
  }
}
async function gameRequest(
  path: string,
  body?: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<{ run: RunDto | null; outcome?: string }> {
  const response = await fetcher(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) throw new TransportError(response.status);
  const value: unknown = await response.json();
  if (path === "/api/players/session") {
    if (
      !value ||
      typeof value !== "object" ||
      !("ready" in value) ||
      value.ready !== true
    )
      throw new TypeError("INVALID_RESPONSE");
    return { run: null };
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("run" in value) ||
    (value.run !== null && !isRunDto(value.run)) ||
    ("outcome" in value && typeof value.outcome !== "string")
  )
    throw new TypeError("INVALID_RESPONSE");
  return {
    run: value.run,
    ...("outcome" in value ? { outcome: value.outcome as string } : {}),
  };
}
export type GameReply = { run: RunDto | null; outcome?: string };
export type PendingCommand = { path: string; body: Record<string, unknown> };
/** HTTP intent and recovery boundary; fetch is injected for non-browser tests. */
export class GameApiClient {
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  request(path: string, body?: Record<string, unknown>): Promise<GameReply> {
    return gameRequest(path, body, this.fetcher);
  }
  bootstrap() {
    return this.request("/api/players/session", {});
  }
  current() {
    return this.request("/api/runs/current");
  }
  read(id: string) {
    return this.request(`/api/runs/${encodeURIComponent(id)}`);
  }
}
