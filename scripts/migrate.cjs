const { existsSync } = require("node:fs");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { getMigrationConnection } = require("./database-config.cjs");

async function main() {
  if (existsSync(".env")) loadEnvFile(".env");
  const connectionString = getMigrationConnection(process.env);
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("Database migrations applied successfully.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
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
});
