import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("builds an isolated Node 22 fixture with no public source or credential files", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "lock-benchmark-"));
  try {
    execFileSync(process.execPath, [
      "scripts/create-benchmark-preview.cjs",
      destination,
    ]);
    const config = JSON.parse(
      fs.readFileSync(path.join(destination, "vercel.json"), "utf8"),
    );
    expect(config.framework).toBeNull();
    expect(config.outputDirectory).toBe("public");
    expect(fs.readdirSync(path.join(destination, "public"))).toEqual([
      "index.html",
    ]);
    expect(
      fs.readdirSync(destination).some((name) => name.startsWith(".env")),
    ).toBe(false);
    const engine = require(path.join(destination, "engine.cjs"));
    expect(engine.createRun(() => 0.5).chestIndex).toBe(1);
    expect(() =>
      execFileSync(
        process.execPath,
        ["scripts/create-benchmark-preview.cjs", destination],
        { stdio: "pipe" },
      ),
    ).toThrow();
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});
