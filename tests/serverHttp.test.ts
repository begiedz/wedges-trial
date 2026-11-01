import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { checkOrigin, handle, validateCommand } from "@/server/game/http";

vi.mock("@/server/game/service", () => ({
  bootstrap: vi.fn(),
  execute: vi.fn(),
  findSession: vi.fn().mockResolvedValue(null),
  readRun: vi.fn(),
  SESSION_SECONDS: 2592000,
}));
const actionId = "12345678-1234-4234-8234-123456789012";
describe("HTTP trust boundary", () => {
  it.each([
    { actionId, score: 100 },
    { actionId, expectedVersion: 0, pinId: 0, direction: 1 },
    { actionId, expectedVersion: 1, pinId: 0, direction: 2 },
    null,
    [],
    { actionId: "bad" },
  ])("rejects malformed or forged input", (body) =>
    expect(() => validateCommand(body, "move")).toThrow(),
  );
  it("rejects missing or cross-site origins", () => {
    expect(() =>
      checkOrigin(new Request("https://trial.test/api/runs")),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("https://trial.test/api/runs", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("https://trial.test/api/runs", {
          headers: { origin: "https://trial.test" },
        }),
      ),
    ).not.toThrow();
  });
  it("requires session and prevents caching on reads", async () => {
    const response = await handle(
      new NextRequest("https://trial.test/api/runs/current"),
      "read",
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).error.code).toBe("SESSION_REQUIRED");
  });
  it("rejects cross-site mutation before authentication", async () => {
    const response = await handle(
      new NextRequest("https://trial.test/api/runs", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
      "create",
    );
    expect(response.status).toBe(403);
  });
});
