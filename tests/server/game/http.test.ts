import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { failureReason } from "@/server/game/diagnostics";
import { checkOrigin, handle, validateCommand } from "@/server/game/http";
import { bootstrap } from "@/server/game/service";

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
    ...["chestMetrics", "totalMetrics", "optimalMoves"].map((field) => ({
      actionId,
      expectedVersion: 1,
      pinId: 0,
      direction: 1,
      [field]: 100,
    })),
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
  it("uses the configured browser origin behind a local reverse proxy", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    try {
      expect(() =>
        checkOrigin(
          new Request("http://localhost:51847/api/runs", {
            headers: { origin: "http://localhost:3000" },
          }),
        ),
      ).not.toThrow();
      expect(() =>
        checkOrigin(
          new Request("http://localhost:51847/api/runs", {
            headers: { origin: "http://evil.test" },
          }),
        ),
      ).toThrow();
      expect(() =>
        checkOrigin(new Request("http://localhost:51847/api/runs")),
      ).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
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

describe("safe server failure diagnostics", () => {
  it("logs a correlated cause without exposing credentials or SQL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(bootstrap).mockRejectedValueOnce(
        new Error("SQL containing private-token", {
          cause: { code: "42P01", detail: "private-token" },
        }),
      );
      const response = await handle(
        new NextRequest("https://trial.test/api/players/session", {
          method: "POST",
          headers: {
            origin: "https://trial.test",
            "content-type": "application/json",
          },
          body: "{}",
        }),
        "session",
      );
      const result = await response.json();
      expect(response.status).toBe(503);
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
        reason: "DATABASE_TABLE_MISSING",
        requestId: result.error.requestId,
        operation: "session",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
      expect(JSON.stringify(result)).not.toContain("DATABASE_TABLE_MISSING");
    } finally {
      log.mockRestore();
    }
  });
  it("recognizes configuration failure and discards untrusted error codes", () => {
    expect(failureReason(new Error("DATABASE_NOT_CONFIGURED"))).toBe(
      "DATABASE_NOT_CONFIGURED",
    );
    expect(failureReason({ code: "private-token", message: "password" })).toBe(
      "UNKNOWN_SERVER_FAILURE",
    );
  });
});
