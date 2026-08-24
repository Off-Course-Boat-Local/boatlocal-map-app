import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordGuestEvent } from "@/lib/guestEvents";
import GuestSavedScreen from "./GuestSavedScreen";
import { addSavedPlace, SAVED_PLACES_STORAGE_KEY } from "@/lib/savedPlaces";
import { ALL_PINS } from "@/lib/data";
import { BRANDS } from "@/lib/brand";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

vi.mock("@/lib/guestEvents", () => ({ recordGuestEvent: vi.fn().mockResolvedValue(undefined) }));

// The empty state's CTAs must carry the `?company=`/`?guide=` tenant
// stand-in across to the List/Map tabs (same pattern as GuestReviewScreen's
// mapHref), so give useSearchParams a realistic preview query to preserve.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("company=coastal&guide=jan"),
}));

const brand = BRANDS.coastal;

const boat = ALL_PINS.find((p) => p.isBoat)!;
const coffee = ALL_PINS.find((p) => p.category === "coffee")!;
const shop = ALL_PINS.find((p) => p.category === "shop")!;

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(recordGuestEvent).mockClear();
});

describe("GuestSavedScreen", () => {
  it("shows an empty state when nothing is saved", () => {
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);
    expect(screen.getAllByText(/nothing saved yet/i).length).toBeGreaterThan(0);
  });

  it("empty-state CTAs link to the List and Map tabs preserving the guest query string", () => {
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    const listLink = screen.getByRole("link", { name: /browse the list/i });
    expect(listLink).toHaveAttribute("href", "/list?company=coastal&guide=jan");

    const mapLink = screen.getByRole("link", { name: /explore the map/i });
    expect(mapLink).toHaveAttribute("href", "/map?company=coastal&guide=jan");
  });

  it("groups saved items by category, with Boats first", () => {
    addSavedPlace(shop.id);
    addSavedPlace(boat.id);
    addSavedPlace(coffee.id);

    const { container } = render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    // Each section heading carries a per-category count badge after the
    // label (reference design) — strip the trailing digits, the grouping
    // and order are what this test protects.
    const headings = Array.from(container.querySelectorAll("h2")).map((h) =>
      h.textContent?.replace(/\d+$/, ""),
    );
    expect(headings).toEqual(["Boats", "Coffee", "Shop"]);
  });

  it("only shows saved items, not everything", () => {
    addSavedPlace(coffee.id);
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    expect(screen.getByText(coffee.name)).toBeInTheDocument();
    expect(screen.queryByText(shop.name)).toBeNull();
  });

  it("shows a live count in the header", () => {
    addSavedPlace(coffee.id);
    addSavedPlace(shop.id);
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);
    expect(screen.getByText(/2 saved/i)).toBeInTheDocument();
  });

  it("unsaving via the row heart removes the item and updates the count", async () => {
    addSavedPlace(coffee.id);
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    await userEvent.click(screen.getByRole("button", { name: `Remove ${coffee.name} from saved` }));

    expect(screen.queryByText(coffee.name)).toBeNull();
    expect(screen.getAllByText(/nothing saved yet/i).length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY) ?? "[]")).toEqual([]);
  });

  it("renders the empty state in Dutch when the LocaleProvider is given nl", () => {
    render(
      <LocaleProvider locale="nl">
        <GuestSavedScreen brand={brand} pins={ALL_PINS} />
      </LocaleProvider>,
    );

    // Header title + empty-state headline and CTAs, all from the nl dictionary.
    expect(screen.getAllByText("Bewaard").length).toBeGreaterThan(0);
    expect(screen.getByText("Nog niets bewaard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bekijk de lijst" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ontdek de kaart" })).toBeInTheDocument();
    // And no stray English copy from the default dictionary.
    expect(screen.queryByText(/nothing saved yet/i)).toBeNull();
  });

  it("never renders a star rating anywhere on the screen", () => {
    addSavedPlace(coffee.id);
    const { container } = render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);
    expect(container.textContent).not.toMatch(/★|rating/i);
  });

  it("carries companySlug/guideSlug attribution and fires boat_book_click when booking a saved boat", async () => {
    addSavedPlace(boat.id);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <GuestSavedScreen brand={brand} guideSlug="jan" companyId="coastal-co" pins={ALL_PINS} />,
    );

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

  it("does not fire boat_book_click for a non-boat saved action", async () => {
    addSavedPlace(coffee.id);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    await userEvent.click(screen.getByRole("button", { name: /walking directions/i }));

    expect(recordGuestEvent).not.toHaveBeenCalled();
  });

  it("carries the same attribution/analytics wiring when booking from the detail overlay", async () => {
    addSavedPlace(boat.id);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <GuestSavedScreen brand={brand} guideSlug="jan" companyId="coastal-co" pins={ALL_PINS} />,
    );

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
