const { existsSync } = require("node:fs");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { getMigrationConnection } = require("./database-config.cjs");

// Session-level lock, acquired before Drizzle creates/reads its migration journal.
// Two builds targeting the same database must not both see a pending migration.
const MIGRATION_LOCK = Object.freeze([0x57544745, 0x4d494752]);

async function runMigrations(
  pool,
  {
    migrationsFolder = "./drizzle",
    migrationsSchema = "drizzle",
    lockTimeoutMs = 60_000,
  } = {},
) {
  if (!Number.isSafeInteger(lockTimeoutMs) || lockTimeoutMs < 1)
    throw new RangeError("Invalid migration lock timeout");
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('lock_timeout', $1, false)", [
      `${lockTimeoutMs}ms`,
    ]);
    await client.query(
      "SELECT pg_advisory_lock($1::integer, $2::integer)",
      MIGRATION_LOCK,
    );
    // Pin Drizzle to the same physical connection that owns the session lock.
    await migrate(drizzle(client), { migrationsFolder, migrationsSchema });
  } finally {
    // Closing the session releases the lock even after migration failure. Never
    // return a locked/configured session to the pool for an unrelated borrower.
    client.release(true);
  }
}

async function main() {
  if (existsSync(".env")) loadEnvFile(".env");
  const connectionString = getMigrationConnection(process.env);
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    await runMigrations(pool);
    console.log("Database migrations applied successfully.");
  } finally {
    await pool.end();
  }
}
function reportMigrationFailure(error) {
  // Database errors can contain connection details; expose only safe diagnostic codes.
  const code = error.cause?.code || error.code;
  console.error(
    "Migration failed:",
    code ||
      ([
        "DIRECT_DATABASE_URL_REQUIRED",
        "DATABASE_URL_INVALID",
        "DATABASE_TARGET_MISMATCH",
      ].includes(error.message)
        ? error.message
        : "DATABASE_ERROR"),
  );
  process.exitCode = 1;
}

if (require.main === module) main().catch(reportMigrationFailure);

module.exports = { MIGRATION_LOCK, runMigrations };
