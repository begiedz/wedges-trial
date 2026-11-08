import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { sessions } from "@/server/db/schema";

export const SESSION_SECONDS = 60 * 60 * 24 * 30;
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function findSession(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await getDatabase()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  return session ?? null;
}
export async function bootstrap(token: string | undefined) {
  const existing = await findSession(token);
  if (existing) return { token: null };
  const nextToken = randomBytes(32).toString("hex");
  await getDatabase()
    .insert(sessions)
    .values({
      id: randomUUID(),
      tokenHash: tokenHash(nextToken),
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
    });
  return { token: nextToken };
}
