import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GuestPlaceRow } from "./GuestPlaceRow";
import { ALL_PINS } from "@/lib/data";

const place = ALL_PINS.find((p) => p.id === "cafe-de-jaren")!;
const boat = ALL_PINS.find((p) => p.id === "sunset-canal")!;

describe("GuestPlaceRow", () => {
  it("shows name, area and meta (hours/price)", () => {
    render(<GuestPlaceRow item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} />);
    expect(screen.getByText(place.name)).toBeInTheDocument();
    expect(screen.getByText(place.area)).toBeInTheDocument();
    expect(screen.getByText(place.meta)).toBeInTheDocument();
  });

  it("never renders a star rating", () => {
    const { container } = render(
      <GuestPlaceRow item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/★|rating/i);
  });

  it("offers 'Book this tour' for a boat and 'Walking directions' for a place", () => {
    const { unmount } = render(
      <GuestPlaceRow item={boat} saved={false} onToggleSaved={() => {}} onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /book this tour/i })).toBeInTheDocument();
    unmount();

    render(<GuestPlaceRow item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} />);
    expect(screen.getByRole("button", { name: /walking directions/i })).toBeInTheDocument();
  });

  it("fires onAction when the primary button is pressed", async () => {
    const onAction = vi.fn();
    render(<GuestPlaceRow item={place} saved={false} onToggleSaved={() => {}} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: /walking directions/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("fires onOpenDetail when the row is tapped, but not when the CTA or heart is tapped", async () => {
    const onOpenDetail = vi.fn();
    const onAction = vi.fn();
    const onToggleSaved = vi.fn();
    render(
      <GuestPlaceRow
        item={place}
        saved={false}
        onToggleSaved={onToggleSaved}
        onAction={onAction}
        onOpenDetail={onOpenDetail}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /walking directions/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: `Save ${place.name}` }));
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText(place.name));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it("shows the place's first photo instead of the category icon when one exists", () => {
    const { container } = render(
      <GuestPlaceRow item={place} saved={false} onToggleSaved={() => {}} onAction={() => {}} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", place.photos[0]);
  });

  it("fires onToggleSaved when the heart is pressed, and reflects saved state", async () => {
    const onToggleSaved = vi.fn();
    const { rerender } = render(
      <GuestPlaceRow item={place} saved={false} onToggleSaved={onToggleSaved} onAction={() => {}} />,
    );

    const heart = screen.getByRole("button", { name: `Save ${place.name}` });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(heart);
    expect(onToggleSaved).toHaveBeenCalledTimes(1);

    rerender(<GuestPlaceRow item={place} saved={true} onToggleSaved={onToggleSaved} onAction={() => {}} />);
    expect(
      screen.getByRole("button", { name: `Remove ${place.name} from saved` }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
