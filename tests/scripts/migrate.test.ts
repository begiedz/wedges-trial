import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.each([
  ["missing URL", false],
  ["pooled URL", true],
])("fails closed without logging connection credentials: %s", (_, pooled) => {
  // Runtime-only marker: no reusable credential or credential-bearing URI in Git.
  const marker = randomUUID();
  const connection = new URL("postgresql://migration-test-pooler.invalid/app");
  connection.username = "test";
  connection.password = marker;
  const url = pooled ? connection.toString() : "";
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
    const output = result.stdout + result.stderr;
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DIRECT_DATABASE_URL_REQUIRED");
    expect(output).not.toContain(marker);
    expect(output).not.toContain("postgresql://");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
