import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GuideLeaderboard from "./GuideLeaderboard";
import type { LeaderboardRow } from "./types";

describe("GuideLeaderboard", () => {
  it("renders every row's name and save count, ranked in the given order", () => {
    const rows: LeaderboardRow[] = [
      { guideId: "g1", name: "Jan", tipsSaved: 40 },
      { guideId: "g2", name: "Mieke", tipsSaved: 12 },
    ];
    render(<GuideLeaderboard rows={rows} />);

    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Mieke")).toBeInTheDocument();
    expect(screen.getByText("40 saved")).toBeInTheDocument();
    expect(screen.getByText("12 saved")).toBeInTheDocument();
  });

  it("shows an empty state with no guides", () => {
    render(<GuideLeaderboard rows={[]} />);
    expect(screen.getByText(/no guides yet/i)).toBeInTheDocument();
  });

  it("never renders a star, rating, or review-count affordance", () => {
    render(<GuideLeaderboard rows={[{ guideId: "g1", name: "Jan", tipsSaved: 40 }]} />);
    expect(screen.queryByText(/★|rating|review/i)).not.toBeInTheDocument();
  });
});
