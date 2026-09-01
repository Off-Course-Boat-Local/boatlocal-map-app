import { describe, expect, it } from "vitest";

import {
  computeHoursStatus,
  formatDuration,
  parseWeeklyHours,
  relativeHoursLabel,
} from "./hoursFormat";

const GOOGLE_STYLE_HOURS =
  "Monday: 8:00 AM – 1:00 AM; Tuesday: 8:00 AM – 1:00 AM; Wednesday: 8:00 AM – 1:00 AM; " +
  "Thursday: 8:00 AM – 1:00 AM; Friday: 8:00 AM – 3:00 AM; Saturday: 7:30 AM – 3:00 AM; " +
  "Sunday: 8:00 AM – 12:00 AM";

describe("parseWeeklyHours", () => {
  it("parses the Google-style seven-day shape", () => {
    const schedule = parseWeeklyHours(GOOGLE_STYLE_HOURS);
    expect(schedule).not.toBeNull();
    expect(schedule).toHaveLength(7);
  });

  it("represents an overnight close as minutes past 1440", () => {
    const schedule = parseWeeklyHours(GOOGLE_STYLE_HOURS)!;
    const monday = schedule.find((d) => d.day === 1)!;
    expect(monday.openMinutes).toBe(8 * 60);
    expect(monday.closeMinutes).toBe(25 * 60); // 1:00 AM next day
  });

  it("parses a 'Closed' day", () => {
    const text =
      "Sunday: Closed; Monday: 9:00 AM – 5:00 PM; Tuesday: 9:00 AM – 5:00 PM; " +
      "Wednesday: 9:00 AM – 5:00 PM; Thursday: 9:00 AM – 5:00 PM; Friday: 9:00 AM – 5:00 PM; " +
      "Saturday: 9:00 AM – 5:00 PM";
    const schedule = parseWeeklyHours(text)!;
    expect(schedule.find((d) => d.day === 0)?.closed).toBe(true);
  });

  it("returns null for guide-entered free text", () => {
    expect(parseWeeklyHours("Tue–Sun 11:00–18:00, closed Mondays")).toBeNull();
    expect(parseWeeklyHours("Always open")).toBeNull();
    expect(parseWeeklyHours("")).toBeNull();
  });

  it("treats a bare '12:00' (no AM/PM) as noon — regression: Museum of the Canals", () => {
    // Real Google Places response, verbatim: some weekdayDescriptions
    // render noon with no AM/PM suffix at all, unlike every other time in
    // the same string.
    const text =
      "Monday: 12:00 – 5:00 PM; Tuesday: 10:00 AM – 5:00 PM; Wednesday: 10:00 AM – 5:00 PM; " +
      "Thursday: 10:00 AM – 5:00 PM; Friday: 10:00 AM – 5:00 PM; Saturday: 10:00 AM – 5:00 PM; " +
      "Sunday: 10:00 AM – 5:00 PM";
    const schedule = parseWeeklyHours(text);
    expect(schedule).not.toBeNull();
    const monday = schedule!.find((d) => d.day === 1)!;
    expect(monday.openMinutes).toBe(12 * 60); // noon, not midnight
    expect(monday.closeMinutes).toBe(17 * 60);
  });

  it("still refuses a bare non-noon hour as genuinely ambiguous", () => {
    const text =
      "Monday: 9:00 – 5:00 PM; Tuesday: 9:00 AM – 5:00 PM; Wednesday: 9:00 AM – 5:00 PM; " +
      "Thursday: 9:00 AM – 5:00 PM; Friday: 9:00 AM – 5:00 PM; Saturday: 9:00 AM – 5:00 PM; " +
      "Sunday: 9:00 AM – 5:00 PM";
    expect(parseWeeklyHours(text)).toBeNull();
  });

  it("returns null when fewer than seven segments are present", () => {
    expect(parseWeeklyHours("Monday: 9:00 AM – 5:00 PM")).toBeNull();
  });
});

describe("computeHoursStatus", () => {
  // Simple Mon–Fri 9–17, closed weekends, no overnight spans — easiest to
  // reason about for the open/closed edge cases below.
  const OFFICE_HOURS =
    "Sunday: Closed; Monday: 9:00 AM – 5:00 PM; Tuesday: 9:00 AM – 5:00 PM; " +
    "Wednesday: 9:00 AM – 5:00 PM; Thursday: 9:00 AM – 5:00 PM; Friday: 9:00 AM – 5:00 PM; " +
    "Saturday: Closed";

  function at(isoWithoutZone: string): Date {
    // Local time, not UTC — computeHoursStatus works entirely in the
    // caller's local clock (the guest's own device time).
    return new Date(isoWithoutZone);
  }

  it("is open mid-afternoon, well before closing", () => {
    const schedule = parseWeeklyHours(OFFICE_HOURS)!;
    // A Wednesday at 14:00.
    const status = computeHoursStatus(schedule, at("2026-09-02T14:00:00"));
    expect(status).toEqual({ kind: "open-closes-in", minutes: 180 });
  });

  it("says closing soon inside the threshold", () => {
    const schedule = parseWeeklyHours(OFFICE_HOURS)!;
    const status = computeHoursStatus(schedule, at("2026-09-02T16:45:00"));
    expect(status).toEqual({ kind: "open-closing-soon" });
  });

  it("says opens in N minutes before today's opening", () => {
    const schedule = parseWeeklyHours(OFFICE_HOURS)!;
    const status = computeHoursStatus(schedule, at("2026-09-02T07:00:00"));
    expect(status).toEqual({ kind: "closed-opens-in", minutes: 120 });
  });

  it("says opening soon just before today's opening", () => {
    const schedule = parseWeeklyHours(OFFICE_HOURS)!;
    const status = computeHoursStatus(schedule, at("2026-09-02T08:45:00"));
    expect(status).toEqual({ kind: "closed-opening-soon" });
  });

  it("looks ahead to the next open day when closed for the weekend", () => {
    const schedule = parseWeeklyHours(OFFICE_HOURS)!;
    // Saturday (closed) at noon -> next open is Monday 9:00 AM: 12h to
    // midnight + 24h Sunday + 9h into Monday = 45h.
    const status = computeHoursStatus(schedule, at("2026-09-05T12:00:00"));
    expect(status.kind).toBe("closed-opens-in");
    if (status.kind === "closed-opens-in") {
      expect(status.minutes).toBe(45 * 60);
    }
  });

  it("treats an overnight span as still open just after midnight", () => {
    const schedule = parseWeeklyHours(GOOGLE_STYLE_HOURS)!;
    // Friday closes at 3:00 AM Saturday — check 1:30 AM Saturday.
    const status = computeHoursStatus(schedule, at("2026-09-05T01:30:00"));
    expect(status.kind).toBe("open-closes-in");
    if (status.kind === "open-closes-in") {
      expect(status.minutes).toBe(90);
    }
  });
});

describe("formatDuration", () => {
  it("formats minutes only under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats whole hours with no remainder", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and minutes together", () => {
    expect(formatDuration(135)).toBe("2h 15m");
  });
});

describe("relativeHoursLabel", () => {
  it("falls back to the raw text when unparseable", () => {
    expect(relativeHoursLabel("Always open")).toBe("Always open");
    expect(relativeHoursLabel("")).toBe("");
  });

  it("returns a relative label for a parseable schedule", () => {
    const label = relativeHoursLabel(GOOGLE_STYLE_HOURS, new Date("2026-09-02T14:00:00"));
    expect(label).toMatch(/^Closes in /);
  });
});
