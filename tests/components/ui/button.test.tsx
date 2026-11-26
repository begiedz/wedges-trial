// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("shared button semantics", () => {
  it("only submits a form when explicitly requested", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button>Reset plates</Button>
        <Button type="submit">Claim score</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset plates" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Claim score" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("renders navigation as one anchor and preserves its click handler", () => {
    const navigate = vi.fn((event) => event.preventDefault());
    render(
      <Button asChild variant="primary">
        <a href="/en/game" onClick={navigate}>
          Play
        </a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Play" });
    expect(link.getAttribute("href")).toBe("/en/game");
    expect(link.hasAttribute("type")).toBe(false);
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("prevents disabled actions", () => {
    const move = vi.fn();
    render(
      <Button disabled onClick={move}>
        Move plate
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move plate" }));
    expect(move).not.toHaveBeenCalled();
  });
});
