import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALL_PINS } from "@/lib/data";
import { BRANDS } from "@/lib/brand";
import type { WelcomeBlock } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";
import { WelcomeBlockRenderer } from "./WelcomeBlockRenderer";

const place = ALL_PINS.find((p) => !p.isBoat)!;
const boat = ALL_PINS.find((p) => p.isBoat)!;

const ctx: WelcomeBlockContext = {
  brand: BRANDS.coastal,
  guideName: "Sergio",
  guideAvatarInitial: "S",
  qs: "company=coastal&guide=sergio",
  pinsById: { [place.id]: place },
  boatTour: { ...boat, bookingUrl: "https://boatlocal.example/book" },
  reviewUrls: { google: "https://g.example/r", tripadvisor: "https://ta.example/r" },
};

const b = (id: string, displayOrder: number, type: string, content: unknown) =>
  ({ id, displayOrder, type, content }) as WelcomeBlock;

describe("WelcomeBlockRenderer", () => {
  it("renders every block type and orders by displayOrder", () => {
    const blocks = [
      b("2", 2, "tip_box", { title: "Local tip", body: "Lock your bike", style: "tip" }),
      b("1", 1, "guide_hero", { title: "Welkom!", greeting: "Thanks!", showAvatar: true }),
      b("3", 3, "review_card", { promptText: "Review us", platforms: ["google", "tripadvisor", "guruwalk"] }),
      b("4", 4, "category_shortcuts", { categoryKeys: ["lunch"] }),
      b("5", 5, "featured_places", { placeIds: [place.id, "missing"], showDiscountBadge: true }),
      b("6", 6, "boat_tour_card", { headline: "Again?" }),
    ];
    const { container } = render(<WelcomeBlockRenderer blocks={blocks} ctx={ctx} />);

    expect(screen.getByText("Welkom!")).toBeInTheDocument();
    expect(screen.getByText("Local tip")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google" })).toHaveAttribute("href", "https://g.example/r");
    expect(screen.getByRole("link", { name: "TripAdvisor" })).toBeInTheDocument();
    // no URL configured for guruwalk → not rendered
    expect(screen.queryByRole("link", { name: "GuruWalk" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "lunch" })).toHaveAttribute(
      "href",
      "/map?company=coastal&guide=sergio&category=lunch",
    );
    expect(screen.getByText("Guest discount")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book now" })).toHaveAttribute("href", "https://boatlocal.example/book");

    const text = container.textContent!;
    expect(text.indexOf("Welkom!")).toBeLessThan(text.indexOf("Local tip"));
  });

  it("renders null for unknown block types without crashing", () => {
    const { container } = render(<WelcomeBlockRenderer blocks={[b("x", 0, "nonsense", {})]} ctx={ctx} />);
    expect(container.textContent).toBe("");
  });

  it("refuses javascript: hrefs in cta_banner", () => {
    render(<WelcomeBlockRenderer blocks={[b("c", 0, "cta_banner", { label: "Go", href: "javascript:alert(1)" })]} ctx={ctx} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
