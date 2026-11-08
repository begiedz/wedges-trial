import { handleLeaderboard } from "@/server/leaderboard/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handleLeaderboard(request);
}
