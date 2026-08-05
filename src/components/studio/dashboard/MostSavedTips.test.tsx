import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MostSavedTips from "./MostSavedTips";
import type { MostSavedTipRow } from "./types";

describe("MostSavedTips", () => {
  it("renders every row's name, category label, and save count", () => {
    const rows: MostSavedTipRow[] = [
      { id: "r1", name: "Café Central", category: "coffee", saveCount: 20 },
      { id: "r2", name: "Canal cruise dock", category: "boats", saveCount: 5 },
    ];
    render(<MostSavedTips rows={rows} />);

    expect(screen.getByText("Café Central")).toBeInTheDocument();
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Canal cruise dock")).toBeInTheDocument();
    expect(screen.getByText("Boats")).toBeInTheDocument();
    expect(screen.getByText("20 saved")).toBeInTheDocument();
    expect(screen.getByText("5 saved")).toBeInTheDocument();
  });

  it("shows an empty state with no recommendations", () => {
    render(<MostSavedTips rows={[]} />);
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
  });

  it("never renders a star, rating, or review-count affordance", () => {
    render(<MostSavedTips rows={[{ id: "r1", name: "Spot", category: "shop", saveCount: 9 }]} />);
    expect(screen.queryByText(/★|rating|review/i)).not.toBeInTheDocument();
  });
});
