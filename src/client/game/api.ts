import type { RunDto } from "@/api/contracts";
import { requestJson } from "../http";
import { isRunDto } from "./response";

// Existing React consumers import this error through the gameplay API.
export { TransportError } from "../http";

async function gameRequest(
  path: string,
  body?: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<{ run: RunDto | null; outcome?: string }> {
  const value = await requestJson(path, { body, fetcher });
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
