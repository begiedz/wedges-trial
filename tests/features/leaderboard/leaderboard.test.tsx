// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardResponse } from "@/api/contracts";
import { TransportError } from "@/client/game/api";
import { getLeaderboardPage } from "@/client/leaderboard";
import { Leaderboard } from "@/features/leaderboard";
import de from "@/i18n/dictionaries/de.json";
import en from "@/i18n/dictionaries/en.json";
import pl from "@/i18n/dictionaries/pl.json";
import ru from "@/i18n/dictionaries/ru.json";
import { I18nProvider } from "@/i18n/provider";
import type { Locale } from "@/i18n/types";

vi.mock("@/client/leaderboard", () => ({ getLeaderboardPage: vi.fn() }));
const api = vi.mocked(getLeaderboardPage);
const t = en.leaderboard;
function page(
  start = 1,
  count = 10,
  nextCursor: string | null = "cursor",
): LeaderboardResponse {
  return {
    rulesetVersion: "scarce-picks-v1",
    nextCursor,
    entries: Array.from({ length: count }, (_, i) => ({
      rank: start + i,
      runId: `run-${start + i}`,
      displayName: "Wedge",
      oreNuggets: 100,
      openedChests: 5,
      finishedAt: "2026-11-07T10:00:00.000Z",
    })),
  };
}
function mount(dictionary = en, locale: Locale = "en") {
  return render(
    <I18nProvider dictionary={dictionary} locale={locale}>
      <Leaderboard />
    </I18nProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("public ranking", () => {
  it.each([
    [en, "en"],
    [pl, "pl"],
    [de, "de"],
    [ru, "ru"],
  ] as const)(
    "localizes anonymous browsing in %s",
    async (dictionary, locale) => {
      api.mockResolvedValue(page(1, 1, null));
      mount(dictionary, locale);
      expect(screen.getByText(dictionary.leaderboard.loading)).toBeTruthy();
      expect(await screen.findByRole("table")).toBeTruthy();
      for (const label of [
        "rank",
        "nickname",
        "ore",
        "chests",
        "finished",
      ] as const)
        expect(
          screen.getByRole("columnheader", {
            name: dictionary.leaderboard[label],
          }),
        ).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: dictionary.home.actions.play })
          .getAttribute("href"),
      ).toBe(`/${locale}/game`);
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(Object.keys(dictionary.leaderboard)).toEqual(Object.keys(t));
      expect(
        screen.getByText(
          new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(new Date("2026-11-07T10:00:00Z")),
        ),
      ).toBeTruthy();
    },
  );
  it("keeps server tie order and duplicate nicknames across cached pages", async () => {
    api.mockResolvedValueOnce(page()).mockResolvedValueOnce(page(11, 2, null));
    mount();
    await screen.findByRole("table");
    expect(screen.getAllByRole("rowheader")).toHaveLength(10);
    expect(screen.getAllByRole("row")[1].textContent).toMatch(/^1Wedge/);
    fireEvent.click(screen.getByRole("button", { name: t.next }));
    await waitFor(() =>
      expect(screen.getAllByRole("rowheader")).toHaveLength(2),
    );
    expect(api).toHaveBeenLastCalledWith(1, "cursor", expect.any(AbortSignal));
    expect(screen.getAllByRole("row")[1].textContent).toMatch(/^11Wedge/);
    expect(
      (screen.getByRole("button", { name: t.next }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t.previous }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(10);
    expect(api).toHaveBeenCalledTimes(2);
  });
  it("reaches rank 1000 and stops", async () => {
    api.mockImplementation(async (index) =>
      page(index * 10 + 1, 10, index === 99 ? null : `cursor-${index}`),
    );
    mount();
    for (let index = 0; index < 100; index++) {
      await screen.findByText(t.page.replace("{page}", String(index + 1)));
      if (index < 99)
        fireEvent.click(screen.getByRole("button", { name: t.next }));
    }
    expect(screen.getAllByRole("row").at(-1)?.textContent).toMatch(
      /^1,000Wedge/,
    );
    expect(
      (screen.getByRole("button", { name: t.next }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("shows empty results and refreshes", async () => {
    api.mockResolvedValue(page(1, 0, null));
    mount();
    await screen.findByText(t.empty);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.refresh }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });
  it("retries failures and refreshes expired snapshots", async () => {
    api
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page())
      .mockRejectedValueOnce(new TransportError(400))
      .mockResolvedValueOnce(page(1, 1, null));
    mount();
    await screen.findByText(t.error);
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: t.next }));
    await screen.findByText(t.expired);
    fireEvent.click(screen.getByRole("button", { name: t.refresh }));
    await screen.findByRole("table");
    expect(api).toHaveBeenLastCalledWith(0, undefined, expect.any(AbortSignal));
  });
  it("ignores a stale request after refresh", async () => {
    let resolve!: (value: LeaderboardResponse) => void;
    api
      .mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        }),
      )
      .mockResolvedValueOnce(page(1, 0, null));
    mount();
    fireEvent.click(screen.getByRole("button", { name: t.refresh }));
    await screen.findByText(t.empty);
    resolve(page());
    await waitFor(() => expect(screen.queryByRole("table")).toBeNull());
  });
});
