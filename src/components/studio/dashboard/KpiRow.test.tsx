import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import KpiRow from "./KpiRow";
import type { KpiItem } from "./types";

describe("KpiRow", () => {
  it("renders one card per item, with its value and label", () => {
    const items: KpiItem[] = [
      { key: "a", label: "Active guides", value: 3 },
      { key: "b", label: "App opens", value: 1234, delta: 12, deltaPeriodLabel: "vs last 30 days" },
    ];
    render(<KpiRow items={items} />);

    expect(screen.getByText("Active guides")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("App opens")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("shows a delta badge only for items that have one", () => {
    const items: KpiItem[] = [
      { key: "a", label: "No delta", value: 5 },
      { key: "b", label: "Positive", value: 10, delta: 8 },
      { key: "c", label: "Negative", value: 2, delta: -6 },
    ];
    render(<KpiRow items={items} />);

    // The delta badge splits the icon glyph and the number/percent into
    // separate text nodes within the same element, so match by substring
    // rather than an exact string.
    expect(screen.getByText(/8%/)).toBeInTheDocument();
    expect(screen.getByText(/6%/)).toBeInTheDocument();
  });

  it("never renders a star, rating, or review-count affordance", () => {
    const items: KpiItem[] = [{ key: "a", label: "Tips saved", value: 42, delta: 5 }];
    render(<KpiRow items={items} />);
    expect(screen.queryByText(/★|star|rating|review/i)).not.toBeInTheDocument();
  });
});
