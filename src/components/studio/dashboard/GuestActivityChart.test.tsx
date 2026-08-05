import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GuestActivityChart from "./GuestActivityChart";
import type { GuestActivityPoint } from "./types";

describe("GuestActivityChart", () => {
  it("renders a bar and label for every data point, plus the total", () => {
    const data: GuestActivityPoint[] = [
      { label: "Mon", value: 10 },
      { label: "Tue", value: 30 },
      { label: "Wed", value: 20 },
    ];
    render(<GuestActivityChart data={data} />);

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("60 total")).toBeInTheDocument();
  });

  it("exposes the series through an accessible label rather than only visually", () => {
    render(<GuestActivityChart data={[{ label: "Mon", value: 10 }]} title="Guest activity" />);
    expect(screen.getByRole("img", { name: /guest activity: mon 10/i })).toBeInTheDocument();
  });
});
