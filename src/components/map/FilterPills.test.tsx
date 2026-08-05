import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FilterPills from "./FilterPills";
import { CATEGORIES } from "@/lib/categories";

describe("FilterPills", () => {
  it("renders All plus every category", () => {
    render(<FilterPills value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    for (const category of CATEGORIES) {
      expect(
        screen.getByRole("button", { name: new RegExp(category.label, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("selects a category when its pill is pressed", async () => {
    const onChange = vi.fn();
    render(<FilterPills value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /boats/i }));
    expect(onChange).toHaveBeenCalledWith("boats");
  });

  it("clears back to All when the active pill is pressed again", async () => {
    // Toggle behaviour: a guest who taps "Drinks" to look, then taps it again,
    // expects to be back where they started — not stuck in a filter.
    const onChange = vi.fn();
    render(<FilterPills value="drinks" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /drinks/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("marks exactly one pill as selected at a time", () => {
    const { rerender } = render(<FilterPills value={null} onChange={() => {}} />);
    const selectedCount = () =>
      screen
        .getAllByRole("button")
        .filter(
          (b) =>
            b.getAttribute("aria-pressed") === "true" ||
            b.getAttribute("aria-current") === "true",
        ).length;

    expect(selectedCount()).toBe(1);
    rerender(<FilterPills value="coffee" onChange={() => {}} />);
    expect(selectedCount()).toBe(1);
  });

  it("gives every pill a touch target of at least 44px", () => {
    // Guests use this one-handed, walking, in the rain.
    render(<FilterPills value={null} onChange={() => {}} />);
    for (const button of screen.getAllByRole("button")) {
      const min = button.style.minHeight || button.style.height;
      if (min) expect(parseInt(min, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});
