import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlaceCard } from "./PlaceCard";
import { ALL_PINS, BOAT_TOURS, PLACES } from "@/lib/data";

const place = ALL_PINS.find((p) => p.id === "cafe-de-jaren")!;
const boat = ALL_PINS.find((p) => p.id === "sunset-canal")!;

describe("PlaceCard", () => {
  it("shows the guide's note in full, never truncated", () => {
    // Regression test. The note used to be merged into a muted subtitle and
    // clamped to two lines, so a real sentence got cut mid-word. The note is
    // what we chose instead of a star rating — clamping it undoes that.
    render(<PlaceCard item={place} />);
    expect(screen.getByText(place.note)).toBeInTheDocument();
  });

  it("shows the locator line separately from the note", () => {
    render(<PlaceCard item={place} />);
    expect(screen.getByText(place.area)).toBeInTheDocument();
  });

  it("never renders a star rating", () => {
    const { container } = render(<PlaceCard item={place} />);
    expect(container.textContent).not.toMatch(/★|\d\.\d\s*★|rating/i);
  });

  it("hides the locator row entirely when there is no locator text (no orphaned icon)", () => {
    // Positive control: a real area renders the pin icon.
    const { container, unmount } = render(<PlaceCard item={place} />);
    expect(container.querySelector(".lucide-map-pin")).not.toBeNull();
    unmount();

    // A place with an empty area (e.g. a BoatLocal-synced cruise, whose feed
    // has no location name) must not render a pin icon with nothing after it.
    const { container: emptyArea, unmount: unmount2 } = render(
      <PlaceCard item={{ ...place, area: "" }} />,
    );
    expect(emptyArea.querySelector(".lucide-map-pin")).toBeNull();
    unmount2();

    // Same for a boat whose meta (its locator line) is empty.
    const { container: emptyMeta } = render(<PlaceCard item={{ ...boat, meta: "" }} />);
    expect(emptyMeta.querySelector(".lucide-clock")).toBeNull();
  });

  it("offers 'Book this tour' for a boat and directions for a place", () => {
    const { unmount } = render(<PlaceCard item={boat} />);
    expect(screen.getByRole("button", { name: /book/i })).toBeInTheDocument();
    unmount();

    render(<PlaceCard item={place} />);
    expect(screen.getByRole("button", { name: /directions/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /book/i })).toBeNull();
  });

  it("fires onAction with the item when the primary button is pressed", async () => {
    const onAction = vi.fn();
    render(<PlaceCard item={boat} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: /book/i }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0].id).toBe(boat.id);
  });

  it("offers public transport alongside walking directions for a place", async () => {
    const onSecondaryAction = vi.fn();
    render(<PlaceCard item={place} onSecondaryAction={onSecondaryAction} />);

    // Walking stays the primary, one-tap action; transit is the compact
    // second option beside it, never a mode picker in front of both.
    expect(screen.getByRole("button", { name: /directions/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /public transport/i }));

    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    expect(onSecondaryAction.mock.calls[0][0].id).toBe(place.id);
  });

  it("never offers public transport for a boat, even when a handler is passed", () => {
    // A boat tour is booked, not travelled to by tram. The `!item.isBoat`
    // half of the render guard is the part a refactor could quietly drop
    // with nothing else to signal it.
    render(<PlaceCard item={boat} onSecondaryAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /public transport/i })).toBeNull();
  });

  it("renders no transit button when no handler is supplied", () => {
    // Every other PlaceCard call site (List, Saved, Welcome, the spikes)
    // omits it and must look exactly as it did before transit existed.
    render(<PlaceCard item={place} />);
    expect(screen.queryByRole("button", { name: /public transport/i })).toBeNull();
  });

  it("reports save toggles by id", async () => {
    const onToggleSaved = vi.fn();
    render(<PlaceCard item={place} saved={false} onToggleSaved={onToggleSaved} />);

    const save = screen
      .getAllByRole("button")
      .find((b) => /sav|heart|bookmark/i.test(b.getAttribute("aria-label") ?? ""));
    expect(save, "a save control should be present").toBeDefined();

    await userEvent.click(save!);
    expect(onToggleSaved).toHaveBeenCalledWith(place.id, true);
  });

  it("only renders a close button when the caller can handle it", () => {
    const { unmount } = render(<PlaceCard item={place} />);
    expect(
      screen.queryByRole("button", { name: /close|dismiss/i }),
    ).toBeNull();
    unmount();

    render(<PlaceCard item={place} onClose={() => {}} />);
    expect(
      screen.getByRole("button", { name: /close|dismiss/i }),
    ).toBeInTheDocument();
  });

  it("renders every place and every boat tour without throwing", () => {
    for (const item of ALL_PINS) {
      const { unmount } = render(<PlaceCard item={item} />);
      expect(screen.getByText(item.name)).toBeInTheDocument();
      unmount();
    }
    expect(PLACES.length + BOAT_TOURS.length).toBe(ALL_PINS.length);
  });
});
