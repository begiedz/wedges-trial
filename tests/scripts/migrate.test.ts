import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.each([
  ["", "DIRECT_DATABASE_URL_REQUIRED"],
  [
    "postgresql://user:must-not-leak@ep-test-pooler.region.neon.tech/app",
    "DIRECT_DATABASE_URL_REQUIRED",
  ],
])("fails closed without logging connection credentials (%s)", (url, code) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-cli-"));
  try {
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/migrate.cjs")],
      {
        cwd: directory,
        env: {
          ...process.env,
          DATABASE_URL: url,
          DATABASE_URL_UNPOOLED: url,
          DATABASE_URL_POOLED: url,
        },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(code);
    expect(result.stderr).not.toMatch(/must-not-leak|postgresql:\/\//);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
