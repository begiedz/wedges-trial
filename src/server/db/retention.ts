import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";

/** Manual maintenance only. Never called by a request or scheduled automatically. */
export async function cleanupExpiredRuns() {
  return getDatabase().transaction(async (tx) => {
    // Same first lock as gameplay. A live owner keeps every action ID reserved.
    // SKIP LOCKED lets maintenance leave busy sessions for the next invocation.
    const owners = await tx.execute<{ id: string }>(sql`
      select id from sessions
      where (expires_at <= now() or revoked_at is not null)
        and (not exists (select 1 from runs where owner_id = sessions.id)
          or exists (
            select 1 from runs r where r.owner_id = sessions.id
              and r.status in ('finished', 'abandoned')
              and r.updated_at < now() - interval '30 days'
              and not exists (select 1 from leaderboard_entries e where e.run_id = r.id)
              and not exists (select 1 from run_actions a where a.run_id = r.id
                and a.created_at >= now() - interval '30 days')
          ))
      order by id limit 100 for update skip locked
    `);
    let deletedRuns = 0;
    for (const { id } of owners.rows) {
      const candidates = await tx.execute<{ id: string }>(sql`
        select r.id from runs r
        where r.owner_id = ${id}::uuid
          and r.status in ('finished', 'abandoned')
          and r.updated_at < now() - interval '30 days'
          and not exists (select 1 from leaderboard_entries e where e.run_id = r.id)
          and not exists (select 1 from run_actions a where a.run_id = r.id
            and a.created_at >= now() - interval '30 days')
        order by r.id limit 100 for update
      `);
      for (const run of candidates.rows) {
        await tx.execute(
          sql`delete from run_actions where run_id = ${run.id}::uuid`,
        );
        const deleted = await tx.execute(
          sql`delete from runs where id = ${run.id}::uuid`,
        );
        deletedRuns += deleted.rowCount ?? 0;
      }
      // FK references and durable claims keep their anonymous owner record.
      await tx.execute(sql`delete from sessions where id = ${id}::uuid
        and not exists (select 1 from runs where owner_id = ${id}::uuid)
        and not exists (select 1 from run_actions where owner_id = ${id}::uuid)`);
    }
    return { deletedRuns };
  });
}
