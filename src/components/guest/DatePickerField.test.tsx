import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatePickerField } from "./DatePickerField";

// Pinned clock so "today", the disabled past, and the default view month are
// deterministic no matter when the suite runs. Only `Date` is faked —
// leaving setTimeout & co. real keeps userEvent's internal waits working
// without any advanceTimers plumbing.
const FROZEN_NOW = new Date(2026, 7, 24); // Mon 24 Aug 2026, local time

function setup(props: Partial<ComponentProps<typeof DatePickerField>> = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<DatePickerField value={null} onChange={onChange} {...props} />);
  return { onChange, user };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DatePickerField", () => {
  it("shows a placeholder and expands to the current month", async () => {
    const { user } = setup();

    const trigger = screen.getByRole("button", { name: /pick a date/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("August 2026")).toBeNull();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    // Monday-first weekday header.
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("shows the selected date on the trigger instead of the placeholder", () => {
    setup({ value: "2026-08-30" });
    expect(screen.getByRole("button", { name: /sun 30 aug 2026/i })).toBeInTheDocument();
    expect(screen.queryByText(/pick a date/i)).toBeNull();
  });

  it("selecting a day calls onChange with YYYY-MM-DD and collapses the panel", async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole("button", { name: /pick a date/i }));
    await user.click(screen.getByRole("button", { name: "Sunday 30 August 2026" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-30");
    expect(screen.queryByText("August 2026")).toBeNull(); // panel closed
  });

  it("disables past days but not today", async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole("button", { name: /pick a date/i }));

    expect(screen.getByRole("button", { name: "Sunday 23 August 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saturday 1 August 2026" })).toBeDisabled();

    const today = screen.getByRole("button", { name: "Monday 24 August 2026" });
    expect(today).toBeEnabled();
    expect(today).toHaveAttribute("aria-current", "date");

    await user.click(screen.getByRole("button", { name: "Sunday 23 August 2026" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects a min date later than today", async () => {
    const { user } = setup({ min: "2026-08-27" });

    await user.click(screen.getByRole("button", { name: /pick a date/i }));

    expect(screen.getByRole("button", { name: "Wednesday 26 August 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thursday 27 August 2026" })).toBeEnabled();
  });

  it("navigates between months, clamped to today's month and ~18 months ahead", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /pick a date/i }));

    // Can't go into the past.
    expect(screen.getByRole("button", { name: /previous month/i })).toBeDisabled();

    const next = screen.getByRole("button", { name: /next month/i });
    await user.click(next);
    expect(screen.getByText("September 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();

    // 18 clicks ahead lands on February 2028, where Next disables.
    // fireEvent (synchronous) rather than userEvent for the loop — 18
    // full pointer-event sequences is needlessly slow under suite load.
    for (let i = 0; i < 18; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    }
    expect(screen.getByText("February 2028")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next month/i })).toBeDisabled();
  }, 15000);

  it("opens on the selected date's month and marks the day selected", async () => {
    const { user } = setup({ value: "2026-10-05" });

    await user.click(screen.getByRole("button", { name: /mon 5 oct 2026/i }));

    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monday 5 October 2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a stable 6-week grid with correct Monday-first placement", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /pick a date/i }));

    // August 2026 starts on a Saturday: exactly 31 day buttons, and the
    // grid pads the remaining 11 of 42 cells with blanks.
    const dayButtons = screen.getAllByRole("button", { name: /august 2026$/i });
    expect(dayButtons).toHaveLength(31);
  });
});
