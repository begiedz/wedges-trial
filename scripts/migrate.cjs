const { existsSync } = require("node:fs");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");

async function main() {
  if (existsSync(".env")) loadEnvFile(".env");
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_DATABASE_URL_REQUIRED");
  if (new URL(connectionString).hostname.includes("-pooler"))
    throw new Error("DIRECT_DATABASE_URL_REQUIRED");
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
      (error.message === "DIRECT_DATABASE_URL_REQUIRED"
        ? error.message
        : "DATABASE_ERROR"),
  );
  process.exitCode = 1;
});
