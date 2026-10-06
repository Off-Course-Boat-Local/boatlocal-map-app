import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import GuestBottomNav from "./GuestBottomNav";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams("company=coastal&guide=jan"),
}));

function renderNav() {
  return render(
    <LocaleProvider locale="en">
      <GuestBottomNav />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  pathname = "/";
});

describe("GuestBottomNav", () => {
  it("lists Home first, then Map, List, Saved, Install", () => {
    renderNav();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent?.replace(/\s*\(.*\)$/, ""))).toEqual([
      "Home",
      "Map",
      "List",
      "Saved",
      "Install",
    ]);
  });

  it("marks Home active on the root and keeps company/guide on every tab", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/?company=coastal&guide=jan");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map?company=coastal&guide=jan");
    expect(screen.getByRole("link", { name: "Map" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark Home active on other pages", () => {
    pathname = "/map";
    renderNav();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
  });

  it("is expanded by default and expands on click when collapsed", () => {
    const { container } = renderNav();
    const nav = container.querySelector("nav")!;
    expect(nav).toHaveAttribute("data-expanded", "true");

    const homeLink = screen.getByRole("link", { name: "Home" });
    // Clicking active tab collapses it
    act(() => {
      fireEvent.click(homeLink);
    });
    expect(nav).toHaveAttribute("data-expanded", "false");

    // Clicking anywhere on the nav while collapsed expands it again
    act(() => {
      fireEvent.click(nav);
    });
    expect(nav).toHaveAttribute("data-expanded", "true");
  });

  it("collapses when scrolling down and expands when scrolling up", () => {
    const { container } = renderNav();
    const nav = container.querySelector("nav")!;
    expect(nav).toHaveAttribute("data-expanded", "true");

    // Create a mock scrolling div with overflow
    const scrollContainer = document.createElement("div");
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 500, configurable: true });
    document.body.appendChild(scrollContainer);

    // Initial position at top
    Object.defineProperty(scrollContainer, "scrollTop", { value: 0, configurable: true, writable: true });
    act(() => {
      fireEvent.scroll(scrollContainer);
    });

    // Scroll down to 80px (scrolling down by 80px from 0)
    Object.defineProperty(scrollContainer, "scrollTop", { value: 80, configurable: true, writable: true });
    act(() => {
      fireEvent.scroll(scrollContainer);
    });
    expect(nav).toHaveAttribute("data-expanded", "false");

    // Scroll up to 40px (scrolling up by 40px)
    Object.defineProperty(scrollContainer, "scrollTop", { value: 40, configurable: true, writable: true });
    act(() => {
      fireEvent.scroll(scrollContainer);
    });
    expect(nav).toHaveAttribute("data-expanded", "true");

    document.body.removeChild(scrollContainer);
  });
});
