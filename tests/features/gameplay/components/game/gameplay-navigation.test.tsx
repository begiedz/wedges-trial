// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameplayNavigation } from "@/features/gameplay";
import { START_NEW_RUN_EVENT } from "@/features/gameplay/events";
import en from "@/i18n/dictionaries/en.json";
import { I18nProvider } from "@/i18n/provider";

const navigation = vi.hoisted(() => ({ pathname: "/en/game" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/image", () => ({
  default: (props: object) => createElement("img", props),
}));
function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, {
    children,
    dictionary: en,
    locale: "en",
  });
}
afterEach(() => {
  cleanup();
  navigation.pathname = "/en/game";
});

describe("gameplay navigation composition", () => {
  it("requests confirmation through the desktop action", () => {
    const handler = vi.fn();
    window.addEventListener(START_NEW_RUN_EVENT, handler);
    try {
      render(createElement(GameplayNavigation), { wrapper });
      fireEvent.click(
        screen.getByRole("button", { name: en.game.actions.newRun }),
      );
      expect(handler).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(START_NEW_RUN_EVENT, handler);
    }
  });

  it("requests confirmation and closes the mobile menu", async () => {
    const handler = vi.fn();
    window.addEventListener(START_NEW_RUN_EVENT, handler);
    try {
      render(createElement(GameplayNavigation), { wrapper });
      fireEvent.click(
        screen.getByRole("button", { name: en.nav.mobile.openMenu }),
      );
      expect(screen.getByRole("dialog")).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: en.game.actions.newRun }),
      );
      expect(handler).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    } finally {
      window.removeEventListener(START_NEW_RUN_EVENT, handler);
    }
  });

  it("links anonymous visitors to ranking from desktop and mobile", async () => {
    navigation.pathname = "/en/leaderboard";
    render(createElement(GameplayNavigation), { wrapper });
    expect(
      screen
        .getByRole("link", { name: en.nav.items.leaderboard })
        .getAttribute("href"),
    ).toBe("/en/leaderboard");
    fireEvent.click(
      screen.getByRole("button", { name: en.nav.mobile.openMenu }),
    );
    const links = screen.getAllByRole("link", {
      name: en.nav.items.leaderboard,
    });
    links[links.length - 1].addEventListener(
      "click",
      (event) => event.preventDefault(),
      { once: true },
    );
    fireEvent.click(links[links.length - 1]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps gameplay actions off other site pages", () => {
    navigation.pathname = "/en/about";
    render(createElement(GameplayNavigation), { wrapper });
    expect(
      screen.queryByRole("button", { name: en.game.actions.newRun }),
    ).toBeNull();
  });
});
