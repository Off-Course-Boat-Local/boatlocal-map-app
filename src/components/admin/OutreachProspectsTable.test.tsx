import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/outreachActions", () => ({
  updateOutreachStatusAction: vi.fn().mockResolvedValue({}),
}));

import type { OutreachProspect } from "@/lib/data/outreach";
import OutreachProspectsTable from "./OutreachProspectsTable";

const mockProspects: OutreachProspect[] = [
  {
    id: "p1",
    name: "Zebra Bike Tours",
    segment: "operator",
    source: "csv",
    website: "zebrabikes.nl",
    phone: null,
    email: "contact@zebrabikes.nl",
    contactName: "Zara",
    instagramHandle: null,
    instagramFollowers: null,
    taRating: 4.8,
    taReviewCount: 150,
    taUrl: null,
    tourType: "Bike Tour",
    priceFrom: 25,
    yearFounded: 2018,
    languages: "English",
    notes: null,
    status: "not_contacted",
    nextActionType: null,
    nextActionDueAt: null,
    lastContactedAt: null,
    companyId: null,
    googlePlaceId: null,
    websiteDomain: "zebrabikes.nl",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "p2",
    name: "Alpha Canal Hotel",
    segment: "hotel",
    source: "agent",
    website: "alphahotel.com",
    phone: null,
    email: "info@alphahotel.com",
    contactName: "Adam",
    instagramHandle: null,
    instagramFollowers: null,
    taRating: 4.5,
    taReviewCount: 500,
    taUrl: null,
    tourType: "Boutique Hotel",
    priceFrom: 150,
    yearFounded: 2010,
    languages: "English, Dutch",
    notes: null,
    status: "replied",
    nextActionType: "call",
    nextActionDueAt: "2026-09-15T00:00:00Z",
    lastContactedAt: "2026-09-02T00:00:00Z",
    companyId: null,
    googlePlaceId: null,
    websiteDomain: "alphahotel.com",
    createdAt: "2026-09-02T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
  },
  {
    id: "p3",
    name: "Beta Walking Tours",
    segment: "operator",
    source: "csv",
    website: "betatours.com",
    phone: null,
    email: "hi@betatours.com",
    contactName: "Ben",
    instagramHandle: null,
    instagramFollowers: null,
    taRating: 4.9,
    taReviewCount: 80,
    taUrl: null,
    tourType: "Walking Tour",
    priceFrom: 20,
    yearFounded: 2020,
    languages: "English, German",
    notes: null,
    status: "declined",
    nextActionType: null,
    nextActionDueAt: null,
    lastContactedAt: null,
    companyId: null,
    googlePlaceId: null,
    websiteDomain: "betatours.com",
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-03T00:00:00Z",
  },
];

function getRenderedNames(container: HTMLElement): string[] {
  const links = container.querySelectorAll("tbody tr td:first-child a");
  return Array.from(links).map((el) => el.textContent?.replace("New", "").trim() ?? "");
}

describe("OutreachProspectsTable", () => {
  it("renders all column headers", () => {
    const { container } = render(<OutreachProspectsTable prospects={mockProspects} />);
    const thead = container.querySelector("thead")!;
    expect(within(thead).getByRole("button", { name: /^Name/i })).toBeInTheDocument();
    expect(within(thead).getByRole("button", { name: /^Segment/i })).toBeInTheDocument();
    expect(within(thead).getByRole("button", { name: /^Tour type/i })).toBeInTheDocument();
    expect(within(thead).getByRole("button", { name: /^Rating/i })).toBeInTheDocument();
    expect(within(thead).getByRole("button", { name: /^Status/i })).toBeInTheDocument();
    expect(within(thead).getByRole("button", { name: /^Next action/i })).toBeInTheDocument();
  });

  it("sorts by name ascending and descending on consecutive clicks", async () => {
    const user = userEvent.setup();
    const { container } = render(<OutreachProspectsTable prospects={mockProspects} />);

    // Default order
    expect(getRenderedNames(container)).toEqual([
      "Zebra Bike Tours",
      "Alpha Canal Hotel",
      "Beta Walking Tours",
    ]);

    // Click Name -> Ascending (oplopend)
    const nameHeader = screen.getByRole("button", { name: /^Name/i });
    await user.click(nameHeader);
    expect(getRenderedNames(container)).toEqual([
      "Alpha Canal Hotel",
      "Beta Walking Tours",
      "Zebra Bike Tours",
    ]);
    expect(screen.getAllByText(/oplopend/i).length).toBeGreaterThan(0);

    // Click Name again -> Descending (aflopend)
    await user.click(nameHeader);
    expect(getRenderedNames(container)).toEqual([
      "Zebra Bike Tours",
      "Beta Walking Tours",
      "Alpha Canal Hotel",
    ]);
    expect(screen.getAllByText(/aflopend/i).length).toBeGreaterThan(0);

    // Click Name third time -> Resets to default
    await user.click(nameHeader);
    expect(getRenderedNames(container)).toEqual([
      "Zebra Bike Tours",
      "Alpha Canal Hotel",
      "Beta Walking Tours",
    ]);
  });

  it("sorts by rating descending on first click", async () => {
    const user = userEvent.setup();
    const { container } = render(<OutreachProspectsTable prospects={mockProspects} />);

    const ratingHeader = screen.getByRole("button", { name: /^Rating/i });
    await user.click(ratingHeader);

    // 4.9 (Beta) > 4.8 (Zebra) > 4.5 (Alpha)
    expect(getRenderedNames(container)).toEqual([
      "Beta Walking Tours",
      "Zebra Bike Tours",
      "Alpha Canal Hotel",
    ]);
  });

  it("allows resetting sort using the reset button", async () => {
    const user = userEvent.setup();
    const { container } = render(<OutreachProspectsTable prospects={mockProspects} />);

    const nameHeader = screen.getByRole("button", { name: /^Name/i });
    await user.click(nameHeader);

    const resetButton = screen.getByRole("button", { name: /Reset to default queue order/i });
    expect(resetButton).toBeInTheDocument();

    await user.click(resetButton);
    expect(getRenderedNames(container)).toEqual([
      "Zebra Bike Tours",
      "Alpha Canal Hotel",
      "Beta Walking Tours",
    ]);
    expect(screen.queryByRole("button", { name: /Reset to default queue order/i })).not.toBeInTheDocument();
  });

  it("renders last contact status and uncontacted indicators", () => {
    const prospectsWithEvents: OutreachProspect[] = [
      {
        ...mockProspects[0],
        lastContactedAt: null,
        events: [],
      },
      {
        ...mockProspects[1],
        lastContactedAt: "2026-09-09T10:00:00Z",
        events: [
          {
            id: "e1",
            prospectId: "p2",
            eventType: "note",
            body: "[WhatsApp] Sent demo link to Adam",
            createdAt: "2026-09-09T10:00:00Z",
          },
        ],
      },
    ];

    render(<OutreachProspectsTable prospects={prospectsWithEvents} />);

    expect(screen.getByText("No contact logged")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });
});
