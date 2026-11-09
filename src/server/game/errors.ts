import { randomUUID } from "node:crypto";
import type { ApiErrorCode, ApiErrorResponse, RunDto } from "@/api/contracts";
export class GameError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    public run?: Pick<RunDto, "id" | "version" | "status">,
  ) {
    super(code);
  }
}

/** Share only the safe public fields; adapters own logging and transport headers. */
export function publicError(error: unknown) {
  const known = error instanceof GameError;
  const body: ApiErrorResponse = {
    error: {
      code: known ? error.code : "SERVICE_UNAVAILABLE",
      requestId: randomUUID(),
      ...(known && error.run
        ? {
            runId: error.run.id,
            currentVersion: error.run.version,
            currentStatus: error.run.status,
          }
        : {}),
    },
  };
  return { body, status: known ? error.status : 503, known };
}
