import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { failureReason } from "@/server/game/diagnostics";
import { handle } from "@/server/game/http";
import { bootstrap, findSession } from "@/server/game/session";
import { checkOrigin, validateCommand } from "@/server/game/validation";
import {
  LeaderboardRateLimitError,
  limitLeaderboard,
} from "@/server/leaderboard/rate-limit";
import { claimEntry, readEligibility } from "@/server/leaderboard/service";

vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/server/leaderboard/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/leaderboard/rate-limit")>()),
  limitLeaderboard: vi.fn(),
}));

vi.mock("@/server/leaderboard/service", () => ({
  claimEntry: vi.fn(),
  readEligibility: vi.fn(),
}));

vi.mock("@/server/game/service", () => ({
  execute: vi.fn(),
  readRun: vi.fn(),
}));
vi.mock("@/server/game/session", () => ({
  bootstrap: vi.fn(),
  findSession: vi.fn().mockResolvedValue(null),
  COOKIE_NAME: "wedges_session",
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

describe("anonymous session HTTP contract", () => {
  it.each(["eligibility", "claim"] as const)(
    "limits private %s by authenticated owner before service work",
    async (operation) => {
      vi.mocked(findSession).mockResolvedValueOnce({
        id: actionId,
      } as NonNullable<Awaited<ReturnType<typeof findSession>>>);
      vi.mocked(claimEntry).mockClear();
      vi.mocked(readEligibility).mockClear();
      vi.mocked(limitLeaderboard).mockRejectedValueOnce(
        new LeaderboardRateLimitError(15),
      );
      const response = await handle(
        new NextRequest(
          `https://trial.test/api/runs/${actionId}/leaderboard-entry`,
          {
            method: operation === "claim" ? "POST" : "GET",
            headers: { origin: "https://trial.test" },
          },
        ),
        operation,
        actionId,
      );
      expect(limitLeaderboard).toHaveBeenLastCalledWith({
        operation,
        ownerId: actionId,
      });
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("15");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.json()).error.code).toBe("RATE_LIMITED");
      expect(claimEntry).not.toHaveBeenCalled();
      expect(readEligibility).not.toHaveBeenCalled();
    },
  );
  const request = (body = "{}") =>
    new NextRequest("https://trial.test/api/players/session", {
      method: "POST",
      headers: {
        origin: "https://trial.test",
        "content-type": "application/json",
      },
      body,
    });
  it("sets a protected expiring cookie and exposes only readiness", async () => {
    vi.mocked(bootstrap).mockResolvedValueOnce({ token: "a".repeat(64) });
    const response = await handle(request(), "session");
    expect(await response.json()).toEqual({ ready: true });
    const cookie = response.cookies.get("wedges_session");
    expect(cookie).toMatchObject({
      value: "a".repeat(64),
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 2592000,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("restores without extending the absolute cookie lifetime", async () => {
    vi.mocked(bootstrap).mockResolvedValueOnce({ token: null });
    const response = await handle(request(), "session");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ready: true });
  });
  it("rejects profile, nickname and ownership fields at bootstrap", async () => {
    for (const body of [
      { nickname: "Wedge" },
      { ownerId: actionId },
      { displayName: "Wedge" },
    ]) {
      expect(
        (await handle(request(JSON.stringify(body)), "session")).status,
      ).toBe(400);
    }
  });
  it.each(["eligibility", "claim"] as const)(
    "authenticates private %s before dispatch",
    async (operation) => {
      vi.mocked(findSession).mockResolvedValueOnce(null);
      const response = await handle(
        new NextRequest(
          `https://trial.test/api/runs/${actionId}/leaderboard-entry`,
          {
            method: operation === "claim" ? "POST" : "GET",
            headers: { origin: "https://trial.test" },
          },
        ),
        operation,
        actionId,
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
  it("protects post-run claims from cross-site requests", async () => {
    vi.mocked(claimEntry).mockClear();
    for (const origin of [undefined, "https://evil.test"]) {
      const response = await handle(
        new NextRequest(
          `https://trial.test/api/runs/${actionId}/leaderboard-entry`,
          {
            method: "POST",
            headers: origin ? { origin } : {},
          },
        ),
        "claim",
        actionId,
      );
      expect(response.status).toBe(403);
    }
    expect(claimEntry).not.toHaveBeenCalled();
    expect(readEligibility).not.toHaveBeenCalled();
  });
});
