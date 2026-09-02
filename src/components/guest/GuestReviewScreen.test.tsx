import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordGuestEvent, recordGuestReview } from "@/lib/guestEvents";
import GuestReviewScreen from "./GuestReviewScreen";
import type { ReviewOption } from "@/lib/guestReview";

vi.mock("@/lib/guestEvents", () => ({
  recordGuestEvent: vi.fn().mockResolvedValue(undefined),
  recordGuestReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const REVIEW_OPTIONS: ReviewOption[] = [
  {
    platform: "google",
    label: "Google",
    url: "https://g.page/r/example/review",
    isPlaceholder: false,
  },
];

function renderScreen() {
  return render(
    <GuestReviewScreen
      companyName="Boat & Bike Co."
      companyId="11111111-1111-1111-1111-111111111111"
      reviewOptions={REVIEW_OPTIONS}
    />,
  );
}

beforeEach(() => {
  vi.mocked(recordGuestEvent).mockClear();
  vi.mocked(recordGuestReview).mockClear();
});

describe("GuestReviewScreen — star rating never gates either option", () => {
  it("renders both options, enabled, before any rating is picked", () => {
    renderScreen();

    const publicLink = screen.getByRole("link", { name: /review us on google/i });
    const privateButton = screen.getByRole("button", { name: /share private feedback instead/i });

    expect(publicLink).toBeInTheDocument();
    expect(privateButton).toBeInTheDocument();
    expect(privateButton).not.toBeDisabled();
    expect(publicLink).toHaveAttribute("href", REVIEW_OPTIONS[0].url);
  });

  it("keeps both options rendered and clickable at a low (1-star) rating", async () => {
    renderScreen();

    await userEvent.click(screen.getByRole("link", { name: "1 star" }));

    const publicLink = screen.getByRole("link", { name: /review us on google/i });
    const privateButton = screen.getByRole("button", { name: /share private feedback instead/i });
    expect(publicLink).toBeInTheDocument();
    expect(privateButton).toBeInTheDocument();
    expect(privateButton).not.toBeDisabled();

    // Still genuinely clickable — opening the private-feedback form works.
    await userEvent.click(privateButton);
    expect(screen.getByLabelText(/tell boat & bike co\. directly/i)).toBeInTheDocument();

    expect(recordGuestReview).toHaveBeenCalledWith({
      companyId: "11111111-1111-1111-1111-111111111111",
      rating: 1,
    });
  });

  it("keeps both options rendered and clickable at a high (5-star) rating", async () => {
    renderScreen();

    await userEvent.click(screen.getByRole("link", { name: "5 stars" }));

    const publicLink = screen.getByRole("link", { name: /review us on google/i });
    const privateButton = screen.getByRole("button", { name: /share private feedback instead/i });
    expect(publicLink).toBeInTheDocument();
    expect(privateButton).toBeInTheDocument();
    expect(privateButton).not.toBeDisabled();
    expect(publicLink).toHaveAttribute("href", REVIEW_OPTIONS[0].url);

    // The public link is still a live, followable link — clicking it fires
    // the same analytics event it always has, never blocked by rating.
    await userEvent.click(publicLink);
    expect(recordGuestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "review_click_google" }),
    );

    expect(recordGuestReview).toHaveBeenCalledWith({
      companyId: "11111111-1111-1111-1111-111111111111",
      rating: 5,
    });
  });

  it("shows a 'Best' badge on the public option only once the rating is positive (4-5)", async () => {
    renderScreen();
    expect(screen.queryByText(/best/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "5 stars" }));
    expect(screen.getByText(/best/i)).toBeInTheDocument();
  });

  // Founder, 2026-09-02: tapping any star should hand the guest straight to
  // the configured review link, same as tapping the explicit option card.
  it("sends every star straight to the configured review link, not just the top one", async () => {
    renderScreen();

    const oneStar = screen.getByRole("link", { name: "1 star" });
    const fiveStars = screen.getByRole("link", { name: "5 stars" });
    expect(oneStar).toHaveAttribute("href", REVIEW_OPTIONS[0].url);
    expect(fiveStars).toHaveAttribute("href", REVIEW_OPTIONS[0].url);

    await userEvent.click(oneStar);
    expect(recordGuestReview).toHaveBeenCalledWith({
      companyId: "11111111-1111-1111-1111-111111111111",
      rating: 1,
    });
    expect(recordGuestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "review_click_google" }),
    );
  });

  // REGRESSION: "Share private feedback instead" is reachable and clickable
  // at rating 0 (that's the whole point of the hard rule above) — submitting
  // from there must send rating: null, never rating: 0. The real table's
  // check constraint only allows 1-5 or null; 0 would be silently rejected
  // by recordGuestReview's error-swallowing contract while the guest still
  // sees a success message.
  it("submits a null rating, not 0, when feedback is sent before any star is picked", async () => {
    renderScreen();

    await userEvent.click(
      screen.getByRole("button", { name: /share private feedback instead/i }),
    );
    await userEvent.type(
      screen.getByLabelText(/tell boat & bike co\. directly/i),
      "Great trip, just forgot to rate it.",
    );
    await userEvent.click(screen.getByRole("button", { name: /send feedback/i }));

    expect(recordGuestReview).toHaveBeenCalledWith({
      companyId: "11111111-1111-1111-1111-111111111111",
      rating: null,
      feedbackText: "Great trip, just forgot to rate it.",
      contact: null,
    });
  });
});
