import type { NextRequest } from "next/server";
import { handle } from "@/server/game/http";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, "eligibility", (await context.params).id);
}
