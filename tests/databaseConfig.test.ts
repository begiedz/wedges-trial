import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { getMigrationConnection } = createRequire(import.meta.url)(
  "../scripts/database-config.cjs",
);
const direct =
  "postgresql://user:password@ep-dev.region.neon.tech/app?sslmode=require";
const pooled =
  "postgresql://user:password@ep-dev-pooler.region.neon.tech/app?sslmode=require";
describe("migration database target guard", () => {
  it("accepts matching direct and pooled endpoints", () => {
    expect(
      getMigrationConnection({
        DATABASE_URL: direct,
        DATABASE_URL_POOLED: pooled,
      }),
    ).toBe(direct);
  });
  it("rejects a migration to a different Neon branch", () => {
    expect(() =>
      getMigrationConnection({
        DATABASE_URL: direct.replace("ep-dev.", "ep-prod."),
        DATABASE_URL_POOLED: pooled,
      }),
    ).toThrow("DATABASE_TARGET_MISMATCH");
  });
  it("rejects a different database on the same endpoint", () => {
    expect(() =>
      getMigrationConnection({
        DATABASE_URL: direct.replace("/app?", "/other?"),
        DATABASE_URL_POOLED: pooled,
      }),
    ).toThrow("DATABASE_TARGET_MISMATCH");
  });
  it("checks the explicit unpooled override too", () => {
    expect(() =>
      getMigrationConnection({
        DATABASE_URL_UNPOOLED: direct.replace("ep-dev.", "ep-prod."),
        DATABASE_URL_POOLED: pooled,
      }),
    ).toThrow("DATABASE_TARGET_MISMATCH");
  });
  it("rejects smart quotes and pooled migration connections", () => {
    expect(() =>
      getMigrationConnection({ DATABASE_URL: `"${direct}”` }),
    ).toThrow("DATABASE_URL_INVALID");
    expect(() => getMigrationConnection({ DATABASE_URL: pooled })).toThrow(
      "DIRECT_DATABASE_URL_REQUIRED",
    );
  });
});
