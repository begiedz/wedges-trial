// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunDto } from "@/api/contracts";
import { GameClient } from "@/features/gameplay/components/game/game-client";
import { START_NEW_RUN_EVENT } from "@/features/gameplay/events";
import { useGameSession } from "@/features/gameplay/hooks/use-game-session";
import en from "@/i18n/dictionaries/en.json";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/features/gameplay/hooks/use-game-session", () => ({
  useGameSession: vi.fn(),
}));
vi.mock("next/image", () => ({
  default: (props: object) => createElement("img", props),
}));
vi.mock("@/features/gameplay/components/lock", () => ({ default: () => null }));
function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, {
    children,
    dictionary: en,
    locale: "en",
  });
}
function fixture(): RunDto {
  return {
    id: "12345678-1234-4234-8234-123456789012",
    version: 1,
    rulesetVersion: "deterministic-ore-v1",
    status: "playing",
    chestIndex: 1,
    openedChests: 0,
    oreNuggets: 0,
    lockpicks: 3,
    difficulty: 1,
    currentLock: {
      pins: [{ id: 0, position: 1, target: 2, min: 0, max: 2 }],
      invalidMovesOnCurrentPick: 0,
      maxInvalidMovesPerPick: 3,
    },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    reward: null,
    result: null,
  };
}
function mount(overrides: Partial<ReturnType<typeof useGameSession>>) {
  const model = {
    run: null,
    error: false,
    loading: false,
    retry: vi.fn(),
    reward: null,
    rewardOpen: false,
    restartOpen: false,
    setRewardOpen: vi.fn(),
    setRestartOpen: vi.fn(),
    move: vi.fn(),
    continueToNextChest: vi.fn(),
    resetLock: vi.fn(),
    startNewRun: vi.fn(),
    requestNewRun: vi.fn(),
    ...overrides,
  };
  vi.mocked(useGameSession).mockReturnValue(model);
  render(createElement(GameClient), { wrapper });
  return model;
}
afterEach(cleanup);
describe("server-backed game UI", () => {
  it("shows localized retry while no run is available", () => {
    const model = mount({ error: true });
    expect(screen.getByText(en.game.connection.error)).toBeTruthy();
    fireEvent.click(screen.getByText(en.game.connection.retry));
    expect(model.retry).toHaveBeenCalledOnce();
  });
  it("preserves keyboard, reset and navigation intents and ignores text entry", () => {
    const model = mount({ run: fixture() });
    fireEvent.keyDown(window, { key: "a" });
    expect(model.move).toHaveBeenCalledWith(0, 1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(model.move).toHaveBeenCalledWith(0, -1);
    fireEvent.keyDown(window, { key: "r" });
    expect(model.resetLock).toHaveBeenCalledOnce();
    fireEvent(window, new Event(START_NEW_RUN_EVENT));
    expect(model.requestNewRun).toHaveBeenCalledOnce();
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "a" });
    input.remove();
    expect(model.move).toHaveBeenCalledTimes(2);
  });
  it.each([{ loading: true }, { restartOpen: true }])(
    "blocks moves and resets while pending or confirming restart",
    (state) => {
      const model = mount({ run: fixture(), ...state });
      fireEvent.keyDown(window, { key: "a" });
      fireEvent.keyDown(window, { key: "r" });
      expect(model.move).not.toHaveBeenCalled();
      expect(model.resetLock).not.toHaveBeenCalled();
    },
  );
  it("keeps failed mutations retryable outside modal dialogs", () => {
    const run: RunDto = {
      ...fixture(),
      status: "chest_opened",
      reward: { oreNuggets: 9, lockpicks: 1 },
      result: null,
    };
    mount({ run, reward: run.reward, rewardOpen: true, error: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(en.game.connection.retry)).toBeTruthy();
  });
});
