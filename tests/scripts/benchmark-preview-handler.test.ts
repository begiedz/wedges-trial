import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createHandler,
} = require("../../scripts/benchmark-preview-handler.cjs");

function response() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

afterEach(() => vi.unstubAllEnvs());
describe("isolated Preview benchmark", () => {
  it("fails closed before running work and restricts methods and parameters", async () => {
    const pool = { query: vi.fn() };
    const handle = createHandler({}, pool, "hash");
    const res = response();
    await handle({ headers: {}, method: "GET", url: "/" }, res);
    expect(res.status).toHaveBeenLastCalledWith(401);
    vi.stubEnv("BENCHMARK_TOKEN", "test-token");
    const headers = { authorization: "Bearer test-token" };
    await handle({ headers, method: "POST", url: "/" }, res);
    expect(res.status).toHaveBeenLastCalledWith(405);
    for (const query of ["chest=999", "seed=-1", "seed=NaN", "mode=unknown"]) {
      await handle({ headers, method: "GET", url: `/?${query}` }, res);
      expect(res.status).toHaveBeenLastCalledWith(400);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("records read-only database probes, serializes work and sanitizes failures", async () => {
    vi.stubEnv("BENCHMARK_TOKEN", "test-token");
    const pool = {
      query: vi
        .fn()
        .mockRejectedValueOnce(new Error("secret connection details"))
        .mockResolvedValue({ rows: [{ started_at: "2026-11-05" }] }),
    };
    const handle = createHandler({}, pool, "hash");
    const req = {
      headers: { authorization: "Bearer test-token" },
      method: "GET",
      url: "/?mode=database",
    };
    const res = response();
    await handle(req, res);
    expect(res.status).toHaveBeenLastCalledWith(503);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "Benchmark failed",
      failureCode: "UNKNOWN",
    });
    const pending = handle(req, res);
    const busy = response();
    await handle(req, busy);
    expect(busy.status).toHaveBeenLastCalledWith(429);
    await pending;
    expect(res.status).toHaveBeenLastCalledWith(200);
    expect(res.json).toHaveBeenLastCalledWith(
      expect.objectContaining({
        invocation: 2,
        firstInvocation: false,
        databaseStartedAt: "2026-11-05",
        engineSha256: "hash",
      }),
    );
    expect(pool.query).toHaveBeenLastCalledWith(
      "SELECT pg_postmaster_start_time() AS started_at",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
