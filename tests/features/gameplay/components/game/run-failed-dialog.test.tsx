// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLeaderboardEligibility } from "@/client/game/leaderboard";
import { RunFailedDialog } from "@/features/gameplay/components/game/run-failed-dialog";
import de from "@/i18n/dictionaries/de.json";
import en from "@/i18n/dictionaries/en.json";
import pl from "@/i18n/dictionaries/pl.json";
import ru from "@/i18n/dictionaries/ru.json";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/client/game/leaderboard", () => ({
  getLeaderboardEligibility: vi.fn(),
  submitLeaderboardEntry: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const result = {
  oreNuggets: 42,
  openedChests: 3,
  finishedAt: new Date(0).toISOString(),
  reason: "lockpicks_exhausted" as const,
};

describe("sequential Game Over and leaderboard modals", () => {
  it.each([
    [en, "en"],
    [pl, "pl"],
    [de, "de"],
    [ru, "ru"],
  ] as const)(
    "shows results before requesting eligibility and opens exactly one localized modal",
    async (dictionary, locale) => {
      vi.mocked(getLeaderboardEligibility).mockResolvedValue({
        eligible: true,
        rank: 1000,
      });
      const onNewRun = vi.fn();
      render(
        <RunFailedDialog
          open
          result={result}
          runId="finished-run"
          onNewRun={onNewRun}
        />,
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <I18nProvider dictionary={dictionary} locale={locale}>
              {children}
            </I18nProvider>
          ),
        },
      );
      const t = dictionary.game;
      expect(
        screen
          .getByRole("link", { name: t.actions.exitGame })
          .getAttribute("href"),
      ).toBe(`/${locale}`);
      expect(
        screen.getByRole("button", { name: t.actions.newRun }),
      ).toBeTruthy();
      expect(
        screen.getByRole("dialog", { name: t.dialogs.failed.title }),
      ).toBeTruthy();
      expect(screen.getByText("42")).toBeTruthy();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(getLeaderboardEligibility).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: t.dialogs.failed.leaderboard }),
      );
      expect(
        screen.queryByRole("dialog", { name: t.dialogs.failed.title }),
      ).toBeNull();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(
        screen.getByRole("dialog", { name: t.leaderboardClaim.title }),
      ).toBeTruthy();
      await screen.findByRole("textbox", { name: t.leaderboardClaim.nickname });
      expect(getLeaderboardEligibility).toHaveBeenCalledWith("finished-run");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(
        screen.getByRole("dialog", { name: t.leaderboardClaim.title }),
      ).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: t.actions.exitGame })
          .getAttribute("href"),
      ).toBe(`/${locale}`);
      fireEvent.click(screen.getByRole("button", { name: t.actions.newRun }));
      expect(onNewRun).toHaveBeenCalledOnce();
    },
  );
  it("offers a new run without a name form for a nonqualifier", async () => {
    vi.mocked(getLeaderboardEligibility).mockResolvedValue({
      eligible: false,
      reason: "below_cutoff",
    });
    render(
      <RunFailedDialog
        open
        result={result}
        runId="finished-run"
        onNewRun={vi.fn()}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider dictionary={en} locale="en">
            {children}
          </I18nProvider>
        ),
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.failed.leaderboard }),
    );
    await screen.findByText(en.game.leaderboardClaim.notQualified);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: en.game.actions.newRun }),
    ).toBeTruthy();
  });
});
