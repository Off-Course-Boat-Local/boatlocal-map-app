import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordGuestEvent } from "@/lib/guestEvents";
import GuestListScreen from "./GuestListScreen";
import { GuestFilterProvider } from "@/lib/guestFilterContext";
import { ALL_PINS } from "@/lib/data";
import { BRANDS } from "@/lib/brand";

vi.mock("@/lib/guestEvents", () => ({ recordGuestEvent: vi.fn().mockResolvedValue(undefined) }));

// The header's LanguageSwitcher calls useRouter() (for router.refresh() on a
// language change) — jsdom has no app router mounted, so stub it. Every
// string assertion below stays English: with no LocaleProvider the i18n
// context defaults to "en".
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const brand = BRANDS.coastal;
const boat = ALL_PINS.find((p) => p.isBoat)!;

function renderList(pins = ALL_PINS, props: Partial<Parameters<typeof GuestListScreen>[0]> = {}) {
  return render(
    <GuestFilterProvider>
      <GuestListScreen brand={brand} guideName="Jan" pins={pins} {...props} />
    </GuestFilterProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(recordGuestEvent).mockClear();
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

  it("carries companySlug/guideSlug attribution and fires boat_book_click when booking a boat from a row", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderList([boat], { guideSlug: "jan", companyId: "coastal-co" });

    await userEvent.click(screen.getByRole("button", { name: /book this tour/i }));

    expect(recordGuestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "boat_book_click",
        companyId: "coastal-co",
        boatTourId: boat.id,
      }),
    );
    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("company")).toBe(brand.id);
    expect(url.searchParams.get("distributor")).toBe("jan");
    openSpy.mockRestore();
  });

  it("does not fire boat_book_click for a non-boat action", async () => {
    const place = ALL_PINS.find((p) => !p.isBoat)!;
    vi.spyOn(window, "open").mockImplementation(() => null);
    renderList([place]);

    await userEvent.click(screen.getByRole("button", { name: /walking directions/i }));

    expect(recordGuestEvent).not.toHaveBeenCalled();
  });

  it("carries the same attribution/analytics wiring when booking from the detail overlay", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderList([boat], { guideSlug: "jan", companyId: "coastal-co" });

    await userEvent.click(screen.getByRole("button", { name: `View details for ${boat.name}` }));
    const dialog = screen.getByRole("dialog", { name: boat.name });
    await userEvent.click(within(dialog).getByRole("button", { name: /book this tour/i }));

    expect(recordGuestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "boat_book_click", companyId: "coastal-co", boatTourId: boat.id }),
    );
    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("distributor")).toBe("jan");
    openSpy.mockRestore();
  });
});
