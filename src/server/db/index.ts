import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDatabase() {
  if (database) return database;
  const connectionString =
    process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });
  attachDatabasePool(pool);
  database = drizzle(pool, { schema });
  return database;
}
