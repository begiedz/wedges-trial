import { describe, expect, it } from "vitest";
import { newRun, transition } from "@/server/game/engine";
import type { StoredRun } from "@/server/game/types";
import {
  compareRankedRuns,
  qualifyRun,
  type RankedRun,
  rankableRun,
} from "@/server/leaderboard/policy";

function finished(index = 0): StoredRun {
  const run = newRun(
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    "same-owner",
  );
  run.status = "finished";
  run.game.finishedAt = "2026-11-03T12:00:00.000Z";
  run.game.state.lockpicks = 0;
  run.game.state.currentLock.isFailed = true;
  run.game.state.oreNuggets = 100;
  run.game.openedChests = 5;
  return run;
}
function entry(index = 0): RankedRun {
  const result = rankableRun(finished(index));
  if (!result) throw new Error("Invalid test fixture");
  return result;
}

describe("endless ore leaderboard policy", () => {
  it("orders ore, chests, chronological finish, then UUID ascending", () => {
    const base = entry(5);
    const higher = [
      { ...base, oreNuggets: 101, openedChests: 0 },
      { ...base, openedChests: 6, finishedAt: "2027-01-01T00:00:00Z" },
      { ...base, finishedAt: "2026-11-03T11:59:59Z" },
      entry(4),
    ];
    for (const candidate of higher) {
      expect(compareRankedRuns(candidate, base)).toBeLessThan(0);
      expect(compareRankedRuns(base, candidate)).toBeGreaterThan(0);
    }
    expect(compareRankedRuns(base, base)).toBe(0);
    expect(
      compareRankedRuns(
        { ...base, finishedAt: "2026-11-03T13:00:00+01:00" },
        base,
      ),
    ).toBe(0);
  });

  it.each([0, 99, 100, 101])(
    "computes cutoff with %i claims without mutating the snapshot",
    (count) => {
      const claims = Array.from({ length: count }, (_, i) =>
        entry(i + 1),
      ).reverse();
      const snapshot = structuredClone(claims);
      const low = finished(999);
      expect(qualifyRun(low, claims)).toEqual(
        count < 100
          ? { eligible: true, rank: count + 1 }
          : { eligible: false, reason: "below_cutoff" },
      );
      expect(qualifyRun(finished(0), claims)).toEqual({
        eligible: true,
        rank: 1,
      });
      expect(claims).toEqual(snapshot);
    },
  );

  it("accepts a zero-score valid finish while fewer than 100 claims exist", () => {
    const run = finished();
    run.game.state.oreNuggets = 0;
    run.game.openedChests = 0;
    expect(qualifyRun(run, [])).toEqual({ eligible: true, rank: 1 });
  });

  it("allows multiple runs by one owner and prevents reclaiming a displaced run", () => {
    const claims = Array.from({ length: 101 }, (_, i) => entry(i));
    expect(qualifyRun(finished(101), [])).toEqual({ eligible: true, rank: 1 });
    expect(qualifyRun(finished(100), claims)).toEqual({
      eligible: false,
      reason: "already_claimed",
    });
    const stronger = finished(102);
    stronger.game.state.oreNuggets++;
    expect(qualifyRun(stronger, claims)).toEqual({ eligible: true, rank: 1 });
  });

  it.each(["playing", "chest_opened", "abandoned"] as const)(
    "excludes %s runs",
    (status) => {
      const run = finished();
      run.status = status;
      expect(qualifyRun(run, [])).toEqual({
        eligible: false,
        reason: "invalid_run",
      });
    },
  );

  it("fails closed on inconsistent final state and malformed scores", () => {
    const mutations = [
      (r: StoredRun) => {
        r.game.finishedAt = null;
      },
      (r: StoredRun) => {
        r.game.finishedAt = "invalid";
      },
      (r: StoredRun) => {
        r.game.state.lockpicks = 1;
      },
      (r: StoredRun) => {
        r.game.state.currentLock.isFailed = false;
      },
      (r: StoredRun) => {
        r.game.state.oreNuggets = -1;
      },
      (r: StoredRun) => {
        r.game.state.oreNuggets = Number.MAX_SAFE_INTEGER + 1;
      },
      (r: StoredRun) => {
        r.game.openedChests = 1.5;
      },
    ];
    for (const mutate of mutations) {
      const run = finished();
      mutate(run);
      expect(rankableRun(run)).toBeNull();
    }
  });

  it("keeps rulesets separate", () => {
    const old = { ...entry(1), rulesetVersion: "legacy" };
    expect(() => compareRankedRuns(old, entry())).toThrow(/rulesets/);
    expect(qualifyRun({ ...finished(), rulesetVersion: "legacy" }, [])).toEqual(
      { eligible: false, reason: "unsupported_ruleset" },
    );
    expect(qualifyRun(finished(), [old])).toEqual({ eligible: true, rank: 1 });
  });

  it("rechecks changing cutoffs without reserving a slot", () => {
    const run = finished(999);
    const claims = Array.from({ length: 99 }, (_, i) => entry(i));
    expect(qualifyRun(run, claims)).toEqual({ eligible: true, rank: 100 });
    expect(qualifyRun(run, [...claims, entry(100)])).toEqual({
      eligible: false,
      reason: "below_cutoff",
    });
  });

  it("uses committed ore rather than pending rewards or client data", () => {
    let run = finished();
    run.status = "playing";
    run.game.state.lockpicks = 1;
    run.game.state.currentLock = {
      pins: [{ id: 0, position: 0, target: 1, min: 0, max: 1 }],
      rules: [
        { sourcePinId: 0, direction: -1, effects: [{ pinId: 0, delta: -1 }] },
      ],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
      isFailed: false,
      isSolved: false,
    };
    run.game.reward = { oreNuggets: 99999, lockpicks: 99 };
    for (let i = 0; i < 3; i++)
      run = transition(run, "move", { pinId: 0, direction: -1 }).run;
    expect(rankableRun(run)?.oreNuggets).toBe(100);
  });
});
