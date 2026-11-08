import type { NextRequest } from "next/server";
import { handle } from "@/server/game/http";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, "reset", (await context.params).id);
}
