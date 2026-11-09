import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredRuns } from "@/server/db/retention";
import { publicError } from "@/server/game/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel supplies the bearer secret; this endpoint never uses player cookies. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "MAINTENANCE_NOT_CONFIGURED" },
      { status: 503, headers },
    );
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers },
    );
  try {
    return NextResponse.json(await cleanupExpiredRuns(), { headers });
  } catch (error) {
    const failure = publicError(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
