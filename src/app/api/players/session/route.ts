import type { NextRequest } from "next/server";
import { handle } from "@/server/game/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(request, "session");
}
