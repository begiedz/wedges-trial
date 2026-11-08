import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/server/db";
import { limitLeaderboard } from "@/server/leaderboard/rate-limit";

vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
describe("leaderboard request budget configuration", () => {
  it.each(["", "0", "-1", "1.5", "Infinity", " 10", "1000000", "1e2"])(
    "fails closed for invalid operational threshold %s",
    async (value) => {
      vi.mocked(getDatabase).mockClear();
      vi.stubEnv("LEADERBOARD_SNAPSHOTS_PER_MINUTE", value);
      await expect(limitLeaderboard({ operation: "snapshot" })).rejects.toThrow(
        "Invalid leaderboard request budget configuration",
      );
      expect(getDatabase).not.toHaveBeenCalled();
    },
  );
});
