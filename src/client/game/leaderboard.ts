import {
  LEADERBOARD_SIZE,
  type LeaderboardClaimRequest,
  type LeaderboardClaimResponse,
  type LeaderboardQualification,
} from "@/api/contracts";
import { requestJson } from "../http";
import { isRunDto } from "./response";

function qualification(value: unknown): value is LeaderboardQualification {
  if (!value || typeof value !== "object") return false;
  if ("eligible" in value && value.eligible === true)
    return (
      "rank" in value &&
      Number.isInteger(value.rank) &&
      Number(value.rank) >= 1 &&
      Number(value.rank) <= LEADERBOARD_SIZE
    );
  return (
    "eligible" in value &&
    value.eligible === false &&
    "reason" in value &&
    [
      "invalid_run",
      "unsupported_ruleset",
      "already_claimed",
      "below_cutoff",
    ].includes(String(value.reason))
  );
}

async function request(
  runId: string,
  body?: LeaderboardClaimRequest,
): Promise<unknown> {
  return requestJson(
    `/api/runs/${encodeURIComponent(runId)}/${body ? "leaderboard-entry" : "leaderboard-eligibility"}`,
    { body },
  );
}

export async function getLeaderboardEligibility(
  runId: string,
): Promise<LeaderboardQualification> {
  const value = await request(runId);
  if (!qualification(value)) throw new TypeError("INVALID_RESPONSE");
  return value;
}

export async function submitLeaderboardEntry(
  runId: string,
  body: LeaderboardClaimRequest,
): Promise<LeaderboardClaimResponse> {
  const value = await request(runId, body);
  if (
    !value ||
    typeof value !== "object" ||
    !("run" in value) ||
    !isRunDto(value.run) ||
    value.run.id !== runId ||
    value.run.status !== "finished"
  )
    throw new TypeError("INVALID_RESPONSE");
  if (
    "outcome" in value &&
    value.outcome === "leaderboard_not_qualified" &&
    "qualification" in value &&
    qualification(value.qualification) &&
    !value.qualification.eligible
  )
    return value as LeaderboardClaimResponse;
  if (
    "outcome" in value &&
    value.outcome === "leaderboard_claimed" &&
    "entry" in value
  ) {
    const entry = value.entry;
    if (
      entry &&
      typeof entry === "object" &&
      "runId" in entry &&
      entry.runId === runId &&
      "displayName" in entry &&
      typeof entry.displayName === "string" &&
      "rank" in entry &&
      Number.isInteger(entry.rank) &&
      Number(entry.rank) >= 1 &&
      Number(entry.rank) <= LEADERBOARD_SIZE &&
      "oreNuggets" in entry &&
      entry.oreNuggets === value.run.result.oreNuggets &&
      "openedChests" in entry &&
      entry.openedChests === value.run.result.openedChests &&
      "finishedAt" in entry &&
      entry.finishedAt === value.run.result.finishedAt
    )
      return value as LeaderboardClaimResponse;
  }
  throw new TypeError("INVALID_RESPONSE");
}
