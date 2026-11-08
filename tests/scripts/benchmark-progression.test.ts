import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";

const {
  buildEngineSource,
  loadEngine,
} = require("../../scripts/benchmark-locks.cjs");
const { runComparison } = require("../../scripts/benchmark-progression.cjs");
it("records paired cohorts, matching seeds, current topology and unchanged resource evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "progression-evidence-"));
  try {
    const built = buildEngineSource();
    const engine = loadEngine(built.source);
    runComparison(engine, directory, {
      samples: 1,
      resourceSamples: 3,
      engineSha256: built.hash,
    });
    expect(readdirSync(directory)).toHaveLength(5);
    const read = (name: string) =>
      JSON.parse(
        gunzipSync(readFileSync(join(directory, `${name}.gz`))).toString(),
      );
    const baseline = read("scarce-picks-v1-survey");
    const current = read("learning-ramp-v1-survey");
    expect(current.raw.map((row: { seed: number }) => row.seed)).toEqual(
      baseline.raw.map((row: { seed: number }) => row.seed),
    );
    expect(current.metadata.engineSha256).toBe(built.hash);
    expect(
      current.raw.find((row: { chest: number }) => row.chest === 18).structure,
    ).toMatchObject({ coreSize: 4, dependencies: 6, tier: 3 });
    expect(read("learning-ramp-v1-resources").metadata.samples).toBe(3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
