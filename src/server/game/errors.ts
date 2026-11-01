import type { ApiErrorCode, RunDto } from "@/api/contracts";
export class GameError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    public run?: Pick<RunDto, "id" | "version" | "status">,
  ) {
    super(code);
  }
}
