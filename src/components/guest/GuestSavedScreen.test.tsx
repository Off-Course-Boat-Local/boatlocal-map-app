import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import GuestSavedScreen from "./GuestSavedScreen";
import { addSavedPlace, SAVED_PLACES_STORAGE_KEY } from "@/lib/savedPlaces";
import { ALL_PINS } from "@/lib/data";
import { BRANDS } from "@/lib/brand";

const brand = BRANDS.coastal;

const boat = ALL_PINS.find((p) => p.isBoat)!;
const coffee = ALL_PINS.find((p) => p.category === "coffee")!;
const shop = ALL_PINS.find((p) => p.category === "shop")!;

beforeEach(() => {
  window.localStorage.clear();
});

describe("GuestSavedScreen", () => {
  it("shows an empty state when nothing is saved", () => {
    render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);
    expect(screen.getAllByText(/nothing saved yet/i).length).toBeGreaterThan(0);
  });

  it("groups saved items by category, with Boats first", () => {
    addSavedPlace(shop.id);
    addSavedPlace(boat.id);
    addSavedPlace(coffee.id);

    const { container } = render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);

    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
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

  it("never renders a star rating anywhere on the screen", () => {
    addSavedPlace(coffee.id);
    const { container } = render(<GuestSavedScreen brand={brand} pins={ALL_PINS} />);
    expect(container.textContent).not.toMatch(/★|rating/i);
  });
});
