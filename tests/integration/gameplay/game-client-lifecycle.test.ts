// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDto } from "@/api/contracts";
import { GameClient } from "@/features/gameplay/components/game/game-client";
import en from "@/i18n/dictionaries/en.json";
import { I18nProvider } from "@/i18n/provider";

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
    lockpicks: 1,
    difficulty: 1,
    currentLock: {
      pins: [{ id: 0, position: 1, min: 0, max: 2, target: 2 }],
      invalidMovesOnCurrentPick: 2,
      maxInvalidMovesPerPick: 3,
    },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    reward: null,
    result: null,
  };
}
const fetchMock = vi.fn();
const ok = (body: unknown) => new Response(JSON.stringify(body));
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", undefined);
  fetchMock.mockReset();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("game dialogs after confirmed server transitions", () => {
  it.each(["chest_opened", "finished"] as const)(
    "opens the %s modal after the move response",
    async (status) => {
      const start = fixture();
      const finished: RunDto =
        status === "chest_opened"
          ? {
              ...start,
              version: 2,
              status,
              reward: { oreNuggets: 10, lockpicks: 0 },
              openedChests: 1,
              result: null,
            }
          : {
              ...start,
              version: 2,
              status,
              lockpicks: 0,
              reward: null,
              result: {
                totalMetrics: { moves: 84, invalidMoves: 12, brokenPicks: 4 },
                oreNuggets: 0,
                openedChests: 0,
                reason: "lockpicks_exhausted",
                finishedAt: new Date(0).toISOString(),
              },
            };
      fetchMock
        .mockResolvedValueOnce(ok({ ready: true }))
        .mockResolvedValueOnce(ok({ run: start }))
        .mockResolvedValueOnce(
          ok({
            run: finished,
            outcome: status === "finished" ? "run_finished" : "chest_opened",
          }),
        );
      render(createElement(GameClient), { wrapper });
      await screen.findByText("Chest: #1");
      fireEvent.keyDown(window, { key: "a" });
      expect(
        await screen.findByRole("dialog", {
          name:
            status === "chest_opened"
              ? en.game.dialogs.reward.title
              : en.game.dialogs.failed.title,
        }),
      ).toBeTruthy();
      if (status === "finished") {
        expect(
          screen.getByText(en.game.dialogs.failed.moves).parentElement
            ?.textContent,
        ).toContain("84");
      }
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );
});
