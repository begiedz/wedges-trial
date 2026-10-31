// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START_NEW_RUN_EVENT } from "@/components/game/events";
import { GameClient } from "@/components/game/GameClient";
import { createRun } from "@/game/createRun";
import { getChestReward } from "@/game/rewards";
import type { RunState } from "@/game/types";
import en from "@/i18n/dictionaries/en.json";
import { I18nProvider } from "@/i18n/provider";

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => createElement("img", props),
}));
vi.mock("@/components/lock", () => ({ default: () => null }));
vi.mock("@/game/createRun", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/game/createRun")>();
  return { ...original, createRun: vi.fn() };
});
vi.mock("@/game/rewards", () => ({ getChestReward: vi.fn() }));
vi.mock("@/game/persistence", () => ({
  loadRunState: () => null,
  saveRunState: vi.fn(),
  clearRunState: vi.fn(),
}));

function fixture(): RunState {
  return {
    chestIndex: 1,
    oreNuggets: 0,
    lockpicks: 1,
    currentLock: {
      pins: [{ id: 0, position: 1, target: 2, min: 0, max: 2 }],
      rules: [
        { sourcePinId: 0, direction: 1, effects: [{ pinId: 0, delta: 1 }] },
        { sourcePinId: 0, direction: -1, effects: [{ pinId: 0, delta: -1 }] },
      ],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
      isSolved: false,
      isFailed: false,
    },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, {
    children,
    dictionary: en,
    locale: "en",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createRun).mockImplementation(fixture);
  vi.mocked(getChestReward).mockReturnValue({ oreNuggets: 12, lockpicks: 1 });
});
afterEach(cleanup);

describe("game client keyboard and dialog integration", () => {
  it("blocks game shortcuts inside reward feedback and uses N only to reopen it", () => {
    render(createElement(GameClient), { wrapper });
    fireEvent.keyDown(window, { key: "a" });
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.reward.title }),
    ).toBeTruthy();

    for (const key of ["n", "r", "d", "a"]) {
      fireEvent.keyDown(window, { key });
    }
    expect(screen.getByText("Chest: #1")).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.moveLeft,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.reset,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(getChestReward).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.close }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.continueToNextChest,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.keyDown(window, { key: "n" });
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.reward.title }),
    ).toBeTruthy();
    expect(getChestReward).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.reward.takeAll }),
    );
    expect(screen.getByText("Chest: #2")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks keyboard moves during restart confirmation and resumes on cancel", () => {
    render(createElement(GameClient), { wrapper });
    fireEvent(window, new Event(START_NEW_RUN_EVENT));
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.restart.title }),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(
      screen.getByRole("button", { name: en.game.dialogs.restart.cancel }),
    );
    expect(createRun).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "a" });
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.reward.title }),
    ).toBeTruthy();
  });

  it("shows final results and starts a new run without an abandon confirmation", () => {
    const run = fixture();
    run.currentLock.pins[0].position = 0;
    run.currentLock.invalidMovesOnCurrentPick = 2;
    vi.mocked(createRun).mockReturnValue(run);
    render(createElement(GameClient), { wrapper });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      screen.getByRole("dialog", { name: en.game.dialogs.failed.title }),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "r" });
    fireEvent.keyDown(window, { key: "a" });
    expect(getChestReward).not.toHaveBeenCalled();
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.moveRight,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.reset,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          en.game.movement.actions.continueToNextChest,
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(createRun).toHaveBeenCalledTimes(1);
    vi.mocked(createRun).mockImplementation(fixture);
    fireEvent.click(
      screen.getByRole("button", { name: en.game.actions.newRun }),
    );
    expect(createRun).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
