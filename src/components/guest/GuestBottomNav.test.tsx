import { render, screen } from "@testing-library/react";
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
});
