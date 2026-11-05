// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChestRewardDialog } from "@/features/gameplay/components/game/ChestRewardDialog";
import { RestartRunDialog } from "@/features/gameplay/components/game/RestartRunDialog";
import { RunFailedDialog } from "@/features/gameplay/components/game/RunFailedDialog";
import de from "@/i18n/dictionaries/de.json";
import en from "@/i18n/dictionaries/en.json";
import pl from "@/i18n/dictionaries/pl.json";
import ru from "@/i18n/dictionaries/ru.json";
import { I18nProvider } from "@/i18n/provider";

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => createElement("img", props),
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, {
    children,
    dictionary: en,
    locale: "en",
  });
}

afterEach(cleanup);

describe("chest reward dialog", () => {
  it("shows the exact reward and total, and only claims on Take all", () => {
    const onContinue = vi.fn();
    const onOpenChange = vi.fn();
    render(
      createElement(ChestRewardDialog, {
        open: true,
        onOpenChange,
        reward: { oreNuggets: 12, lockpicks: 1 },
        totalOre: 42,
        onContinue,
      }),
      { wrapper },
    );

    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.reward.title }),
    ).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.close }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.reward.takeAll }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("collects on Space, prevents scrolling, and ignores held-key repeats", () => {
    const onContinue = vi.fn();
    render(
      createElement(ChestRewardDialog, {
        open: true,
        onOpenChange: vi.fn(),
        reward: { oreNuggets: 8, lockpicks: 0 },
        totalOre: 8,
        onContinue,
      }),
      { wrapper },
    );

    const dialog = screen.getByRole("dialog");
    expect(fireEvent.keyDown(dialog, { key: " ", code: "Space" })).toBe(false);
    fireEvent.keyDown(dialog, { key: " ", code: "Space", repeat: true });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("omits absent lockpicks and allows Escape without collecting loot", () => {
    const onContinue = vi.fn();
    const onOpenChange = vi.fn();
    render(
      createElement(ChestRewardDialog, {
        open: true,
        onOpenChange,
        reward: { oreNuggets: 8, lockpicks: 0 },
        totalOre: 8,
        onContinue,
      }),
      { wrapper },
    );

    expect(screen.queryByText(en.game.labels.lockpick)).toBeNull();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe("failed run dialog", () => {
  it.each([en, pl, de, ru])(
    "renders localized statistic labels with matching dictionary keys",
    (dictionary) => {
      expect(Object.keys(dictionary.game.dialogs.failed).sort()).toEqual(
        Object.keys(en.game.dialogs.failed).sort(),
      );
      render(
        createElement(RunFailedDialog, {
          open: true,
          result: {
            oreNuggets: 57,
            openedChests: 4,
            finishedAt: new Date(0).toISOString(),
            reason: "lockpicks_exhausted",
            totalMetrics: { moves: 123, invalidMoves: 9, brokenPicks: 3 },
          },
          onNewRun: vi.fn(),
        }),
        {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(I18nProvider, { dictionary, locale: "en", children }),
        },
      );
      for (const metric of ["moves", "invalidMoves", "brokenPicks"] as const)
        expect(
          screen.getByText(dictionary.game.dialogs.failed[metric]),
        ).toBeTruthy();
    },
  );
  it("marks statistics unavailable for a legacy replay instead of inventing zero totals", () => {
    render(
      createElement(RunFailedDialog, {
        open: true,
        result: {
          oreNuggets: 0,
          openedChests: 0,
          finishedAt: new Date(0).toISOString(),
          reason: "lockpicks_exhausted",
        },
        onNewRun: vi.fn(),
      }),
      { wrapper },
    );
    expect(
      screen.getAllByText(en.game.dialogs.failed.unavailable),
    ).toHaveLength(3);
  });
  it("shows final results and keeps the modal open on Escape", () => {
    const onNewRun = vi.fn();
    render(
      createElement(RunFailedDialog, {
        open: true,
        result: {
          oreNuggets: 57,
          openedChests: 4,
          finishedAt: new Date(0).toISOString(),
          reason: "lockpicks_exhausted",
          totalMetrics: { moves: 123, invalidMoves: 9, brokenPicks: 3 },
        },
        onNewRun,
      }),
      { wrapper },
    );

    expect(screen.getByText("57")).toBeTruthy();
    for (const [label, count] of [
      [en.game.dialogs.failed.moves, "123"],
      [en.game.dialogs.failed.invalidMoves, "9"],
      [en.game.dialogs.failed.brokenPicks, "3"],
    ]) {
      expect(screen.getByText(label).parentElement?.textContent).toContain(
        count,
      );
    }
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.failed.title }),
    ).toBeTruthy();
    expect(onNewRun).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: en.game.actions.newRun }),
    );
    expect(onNewRun).toHaveBeenCalledTimes(1);
  });
});

describe("restart confirmation", () => {
  it("focuses the safe action and allows cancellation without confirming", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      createElement(RestartRunDialog, { open: true, onOpenChange, onConfirm }),
      { wrapper },
    );

    const cancel = screen.getByRole("button", {
      name: en.game.dialogs.restart.cancel,
    });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("requires the explicit restart action", () => {
    const onConfirm = vi.fn();
    render(
      createElement(RestartRunDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm,
      }),
      { wrapper },
    );

    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.restart.confirm }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
