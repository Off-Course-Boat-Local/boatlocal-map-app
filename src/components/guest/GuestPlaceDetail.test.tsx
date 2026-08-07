import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GuestPlaceDetail } from "./GuestPlaceDetail";
import { ALL_PINS } from "@/lib/data";

const place = ALL_PINS.find((p) => p.id === "cafe-de-jaren")!;
const boat = ALL_PINS.find((p) => p.id === "sunset-canal")!;

describe("GuestPlaceDetail", () => {
  it("shows the name, full note, and every photo (hero + grid)", () => {
    const { container } = render(
      <GuestPlaceDetail item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText(place.name)).toBeInTheDocument();
    expect(screen.getByText(place.note)).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(place.photos.length);
  });

  it("never renders a star rating", () => {
    const { container } = render(
      <GuestPlaceDetail item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} onClose={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/★|rating/i);
  });

  it("offers 'Book this tour' for a boat and 'Walking directions' for a place, at the top of the content", () => {
    const { unmount } = render(
      <GuestPlaceDetail item={boat} saved={false} onToggleSaved={() => {}} onAction={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /book this tour/i })).toBeInTheDocument();
    unmount();

    render(
      <GuestPlaceDetail item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /walking directions/i })).toBeInTheDocument();
  });

  it("fires onAction, onToggleSaved, and onClose from their respective controls", async () => {
    const onAction = vi.fn();
    const onToggleSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <GuestPlaceDetail
        item={place}
        saved={false}
        onToggleSaved={onToggleSaved}
        onAction={onAction}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /walking directions/i }));
    expect(onAction).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: `Save ${place.name}` }));
    expect(onToggleSaved).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the full-screen photo lightbox when a grid photo is tapped", async () => {
    render(
      <GuestPlaceDetail item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} onClose={() => {}} />,
    );
    expect(screen.queryByRole("dialog", { name: `${place.name} photos` })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show photo 2 of 3" }));
    expect(screen.getByRole("dialog", { name: `${place.name} photos` })).toBeInTheDocument();
  });
});
