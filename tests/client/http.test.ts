import { describe, expect, it, vi } from "vitest";
import { requestJson } from "@/client/http";

describe("shared JSON requests", () => {
  it("cancels an in-flight request without retrying it", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>((_path, options) => {
      const signal = options?.signal;
      if (!signal) throw new Error("Missing cancellation signal");
      return new Promise((_resolve, reject) => {
        signal.throwIfAborted();
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    });
    const pending = requestJson("/api/leaderboard", {
      fetcher,
      signal: controller.signal,
    });
    const reason = new DOMException("Cancelled by caller", "AbortError");
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON before endpoint validation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{"));
    await expect(
      requestJson("/api/runs/current", { fetcher }),
    ).rejects.toBeInstanceOf(SyntaxError);
  });

  it("propagates an uncertain network failure without resubmitting the intent", async () => {
    const failure = new TypeError("Network unavailable");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
    await expect(
      requestJson("/api/runs", {
        fetcher,
        body: { actionId: "original-action" },
      }),
    ).rejects.toBe(failure);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
