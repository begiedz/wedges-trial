import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/maintenance/cleanup/route";
import { cleanupExpiredRuns } from "@/server/db/retention";

vi.mock("@/server/db/retention", () => ({ cleanupExpiredRuns: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const request = (authorization?: string) =>
  new Request("https://trial.test/api/maintenance/cleanup", {
    headers: authorization ? { authorization } : {},
  });

describe("scheduled data retention", () => {
  it("fails closed without configuration or a matching bearer credential", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-maintenance-token");
    for (const value of [
      undefined,
      "Bearer wrong",
      "Bearer test-maintenance-tokex",
    ])
      expect((await GET(request(value))).status).toBe(401);
    expect(cleanupExpiredRuns).not.toHaveBeenCalled();
  });
  it("runs bounded cleanup only after authentication and never caches its result", async () => {
    vi.stubEnv("CRON_SECRET", "test-maintenance-token");
    vi.mocked(cleanupExpiredRuns).mockResolvedValueOnce({ deletedRuns: 2 });
    const response = await GET(request("Bearer test-maintenance-token"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ deletedRuns: 2 });
    expect(cleanupExpiredRuns).toHaveBeenCalledOnce();
  });
  it("returns a safe failure without database or credential details", async () => {
    vi.stubEnv("CRON_SECRET", "test-maintenance-token");
    vi.mocked(cleanupExpiredRuns).mockRejectedValueOnce(
      new Error("private database details"),
    );
    const response = await GET(request("Bearer test-maintenance-token"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        requestId: expect.any(String),
      },
    });
  });
});
