import { describe, expect, it } from "vitest";

import {
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUS_TONES,
  OUTREACH_STATUSES,
  type OutreachStatus,
} from "./outreachStatus";

describe("outreachStatus", () => {
  it("defines the exact 5 status values from the database check constraint", () => {
    const expected: OutreachStatus[] = [
      "not_contacted",
      "emailed",
      "replied",
      "declined",
      "onboarded",
    ];
    expect(OUTREACH_STATUSES).toEqual(expected);
  });

  it("provides human-readable labels for every status", () => {
    for (const status of OUTREACH_STATUSES) {
      expect(OUTREACH_STATUS_LABELS[status]).toBeDefined();
      expect(typeof OUTREACH_STATUS_LABELS[status]).toBe("string");
      expect(OUTREACH_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("assigns an allowed tone (positive, neutral, warning) to every status", () => {
    const validTones = new Set(["positive", "neutral", "warning"]);
    for (const status of OUTREACH_STATUSES) {
      const tone = OUTREACH_STATUS_TONES[status];
      expect(validTones.has(tone)).toBe(true);
    }
  });

  it("has appropriate tones for key pipeline states", () => {
    expect(OUTREACH_STATUS_TONES.replied).toBe("positive");
    expect(OUTREACH_STATUS_TONES.onboarded).toBe("positive");
    expect(OUTREACH_STATUS_TONES.declined).toBe("warning");
    expect(OUTREACH_STATUS_TONES.not_contacted).toBe("neutral");
    expect(OUTREACH_STATUS_TONES.emailed).toBe("neutral");
  });
});
