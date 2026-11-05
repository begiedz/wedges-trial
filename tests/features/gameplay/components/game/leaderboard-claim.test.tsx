// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransportError } from "@/client/game/api";
import {
  getLeaderboardEligibility,
  submitLeaderboardEntry,
} from "@/client/game/leaderboard";
import { LeaderboardClaim } from "@/features/gameplay/components/game/leaderboard-claim";
import de from "@/i18n/dictionaries/de.json";
import en from "@/i18n/dictionaries/en.json";
import pl from "@/i18n/dictionaries/pl.json";
import ru from "@/i18n/dictionaries/ru.json";
import { I18nProvider } from "@/i18n/provider";
import { newRun, publicRun } from "@/server/game/engine";

vi.mock("@/client/game/leaderboard", () => ({
  getLeaderboardEligibility: vi.fn(),
  submitLeaderboardEntry: vi.fn(),
}));
const runId = "12345678-1234-4234-8234-123456789012";
const t = en.game.leaderboardClaim;
function mount(dictionary = en) {
  return render(<LeaderboardClaim runId={runId} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider dictionary={dictionary} locale="en">
        {children}
      </I18nProvider>
    ),
  });
}
function finished() {
  const run = newRun(runId, "owner");
  run.status = "finished";
  run.game.finishedAt = new Date(0).toISOString();
  run.game.state.lockpicks = 0;
  run.game.state.currentLock.isFailed = true;
  return publicRun(run);
}
function enter(name = "Wedge") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: t.submit }));
}
beforeEach(() => {
  vi.mocked(getLeaderboardEligibility).mockResolvedValue({
    eligible: true,
    rank: 1,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("post-run nickname entry", () => {
  it.each([en, pl, de, ru])(
    "localizes the qualified form and dictionary keys",
    async (dictionary) => {
      expect(Object.keys(dictionary.game.leaderboardClaim)).toEqual(
        Object.keys(t),
      );
      mount(dictionary);
      expect(
        await screen.findByRole("textbox", {
          name: dictionary.game.leaderboardClaim.nickname,
        }),
      ).toBeTruthy();
      expect(
        screen.getByText(dictionary.game.leaderboardClaim.help),
      ).toBeTruthy();
    },
  );
  it.each([
    "below_cutoff",
    "already_claimed",
    "invalid_run",
    "unsupported_ruleset",
  ] as const)("omits the form for %s", async (reason) => {
    vi.mocked(getLeaderboardEligibility).mockResolvedValue({
      eligible: false,
      reason,
    });
    mount();
    await screen.findByText(
      reason === "already_claimed" ? t.alreadyClaimed : t.notQualified,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(submitLeaderboardEntry).not.toHaveBeenCalled();
  });
  it("validates code points and control characters before sending", async () => {
    mount();
    await screen.findByRole("textbox");
    for (const name of [" ", "x".repeat(25), "a\u0085b"]) {
      enter(name);
      expect(screen.getByRole("alert").textContent).toBe(t.invalid);
    }
    expect(submitLeaderboardEntry).not.toHaveBeenCalled();
  });
  it("retries unknown commits with the original action/name, prevents concurrent submits and renders plain text", async () => {
    vi.mocked(submitLeaderboardEntry).mockRejectedValueOnce(
      new TypeError("offline"),
    );
    mount();
    await screen.findByRole("textbox");
    enter("  <img src=x>  ");
    await screen.findByText(t.network);
    const first = vi.mocked(submitLeaderboardEntry).mock.calls[0];
    expect(first[0]).toBe(runId);
    expect(first[1]).toEqual({
      actionId: expect.any(String),
      nickname: "<img src=x>",
    });
    expect(screen.getByRole("textbox").hasAttribute("readonly")).toBe(true);
    let resolve!: (
      value: Awaited<ReturnType<typeof submitLeaderboardEntry>>,
    ) => void;
    vi.mocked(submitLeaderboardEntry).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    const form = screen.getByRole("textbox").closest("form");
    if (!form) throw new Error("Missing nickname form");
    fireEvent.submit(form);
    expect(submitLeaderboardEntry).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitLeaderboardEntry).mock.calls[1]).toEqual(first);
    await act(async () =>
      resolve({
        run: finished(),
        outcome: "leaderboard_claimed",
        entry: {
          rank: 1,
          runId,
          displayName: "<img src=x>",
          oreNuggets: 0,
          openedChests: 0,
          finishedAt: new Date(0).toISOString(),
        },
      }),
    );
    expect(screen.getByText(t.saved)).toBeTruthy();
    expect(screen.getByText("<img src=x>").querySelector("img")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("handles a changed cutoff at submission", async () => {
    vi.mocked(submitLeaderboardEntry).mockResolvedValue({
      run: finished(),
      outcome: "leaderboard_not_qualified",
      qualification: { eligible: false, reason: "below_cutoff" },
    });
    mount();
    await screen.findByRole("textbox");
    enter();
    await screen.findByText(t.noLongerQualified);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("lets the player correct a server-rejected name with a new action ID", async () => {
    vi.mocked(submitLeaderboardEntry).mockRejectedValue(
      new TransportError(400),
    );
    mount();
    await screen.findByRole("textbox");
    enter();
    await screen.findByRole("alert");
    enter("Diego");
    await waitFor(() =>
      expect(submitLeaderboardEntry).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(submitLeaderboardEntry).mock.calls;
    expect(calls[0][1].actionId).not.toBe(calls[1][1].actionId);
    expect(calls[1][1].nickname).toBe("Diego");
  });
  it.each(["check", "submit"])(
    "handles expired sessions during %s without creating replacement credentials",
    async (stage) => {
      if (stage === "check")
        vi.mocked(getLeaderboardEligibility).mockRejectedValue(
          new TransportError(401),
        );
      else
        vi.mocked(submitLeaderboardEntry).mockRejectedValue(
          new TransportError(401),
        );
      mount();
      if (stage === "submit") {
        await screen.findByRole("textbox");
        enter();
      }
      await screen.findByText(t.expired);
      expect(screen.queryByRole("textbox")).toBeNull();
    },
  );
  it("retries a failed qualification request", async () => {
    vi.mocked(getLeaderboardEligibility).mockRejectedValueOnce(
      new Error("offline"),
    );
    mount();
    await screen.findByText(t.network);
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await screen.findByRole("textbox");
    expect(getLeaderboardEligibility).toHaveBeenCalledTimes(2);
  });
});
