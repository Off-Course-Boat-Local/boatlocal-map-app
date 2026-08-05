import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import GuestListScreen from "./GuestListScreen";
import { GuestFilterProvider } from "@/lib/guestFilterContext";
import { ALL_PINS } from "@/lib/data";
import { BRANDS } from "@/lib/brand";

const brand = BRANDS.coastal;

function renderList(pins = ALL_PINS) {
  return render(
    <GuestFilterProvider>
      <GuestListScreen brand={brand} guideName="Jan" pins={pins} />
    </GuestFilterProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("GuestListScreen", () => {
  it("lists every pin by default, boats first (as the feed already orders them)", () => {
    const { container } = renderList();
    const rows = container.querySelectorAll("li");
    expect(rows).toHaveLength(ALL_PINS.length);
    expect(screen.getByText(ALL_PINS[0].name)).toBeInTheDocument();
  });

  it("filters rows by category via the shared FilterPills", async () => {
    const { container } = renderList();

    await userEvent.click(screen.getByRole("button", { name: "Coffee" }));

    const rows = container.querySelectorAll("li");
    const coffeeCount = ALL_PINS.filter((p) => p.category === "coffee").length;
    expect(rows).toHaveLength(coffeeCount);
  });

  it("never renders a star rating anywhere on the screen", () => {
    const { container } = renderList();
    expect(container.textContent).not.toMatch(/★|rating/i);
  });

  it("shows an empty state when a filter matches nothing", async () => {
    renderList(ALL_PINS.filter((p) => p.category !== "shop"));
    await userEvent.click(screen.getByRole("button", { name: "Shop" }));
    expect(screen.getByText(/no recommendations/i)).toBeInTheDocument();
  });
});
