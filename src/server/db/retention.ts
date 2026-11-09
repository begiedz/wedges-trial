import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";

/** Physical reclamation only; private reads enforce expiry before this job runs. */
export async function cleanupExpiredRuns() {
  return getDatabase().transaction(async (tx) => {
    const owners = await tx.execute<{ id: string }>(sql`
      select s.id from sessions s
      where s.expires_at <= now() or s.revoked_at is not null
        or exists (select 1 from runs r where r.owner_id=s.id and r.expires_at<=now())
      order by s.id limit 100 for update of s skip locked
    `);
    let deletedRuns = 0;
    for (const { id } of owners.rows) {
      const removed = await tx.execute(sql`
        delete from runs where id in (
          select r.id from runs r join sessions s on s.id=r.owner_id
          where r.owner_id=${id}::uuid
            and (r.expires_at<=now() or s.expires_at<=now() or s.revoked_at is not null)
          order by r.id limit 100 for update of r
        )
      `);
      deletedRuns += removed.rowCount ?? 0;
      // Creation markers remain while the session is live, blocking delayed retries.
      await tx.execute(sql`delete from sessions where id=${id}::uuid
        and (expires_at<=now() or revoked_at is not null)
        and not exists (select 1 from runs where owner_id=${id}::uuid)`);
    }
    return { deletedRuns };
  });
}
