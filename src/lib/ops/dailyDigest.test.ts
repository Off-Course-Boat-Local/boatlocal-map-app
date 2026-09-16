import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  formatDailyOpsDigestSlackMessage,
  summarizeProspectEvents,
  getStartOfDayAmsterdam,
  DailyOpsDigestData,
  DigestProspectActivity,
} from "./dailyDigest";

describe("summarizeProspectEvents", () => {
  it("summarizes single email sent", () => {
    const activity: DigestProspectActivity = {
      prospectId: "1",
      name: "360 Amsterdam Tours",
      contactName: "Anja",
      status: "emailed",
      nextActionType: null,
      nextActionDueAt: null,
      events: [
        {
          id: "e1",
          eventType: "email_sent",
          body: "[Email] Goedemiddag...",
          createdAt: "2026-09-15T13:55:00Z",
        },
      ],
    };
    const summary = summarizeProspectEvents(activity);
    expect(summary.typeSummary).toBe("1 touchpoint (1 email)");
    expect(summary.highlight).toContain("Outreach / proposal email sent");
  });

  it("detects meeting in event notes", () => {
    const activity: DigestProspectActivity = {
      prospectId: "2",
      name: "Those Amsterdames",
      contactName: "Kendra Borgen",
      status: "emailed",
      nextActionType: "call",
      nextActionDueAt: "2026-09-21T00:00:00Z",
      events: [
        {
          id: "e1",
          eventType: "call_logged",
          body: "[Call] went straight to voicemail",
          createdAt: "2026-09-15T12:18:00Z",
        },
        {
          id: "e2",
          eventType: "note",
          body: "[Meeting proposed] Meeting set",
          createdAt: "2026-09-15T14:15:00Z",
        },
      ],
    };
    const summary = summarizeProspectEvents(activity);
    expect(summary.typeSummary).toBe("2 touchpoints (1 note, 1 call)");
    expect(summary.highlight).toContain("*Meeting set / discussed*");
    expect(summary.highlight).toContain("Follow-up call due 21 Sept");
  });
});

describe("formatDailyOpsDigestSlackMessage", () => {
  it("handles empty activity gracefully", () => {
    const emptyData: DailyOpsDigestData = {
      dateLabel: "Tuesday, Sep 15, 2026",
      prospectActivities: [],
      companyChanges: [],
    };
    const text = formatDailyOpsDigestSlackMessage(emptyData);
    expect(text).toContain("*Daily Operations & Partner Outreach Digest — Tuesday, Sep 15, 2026*");
    expect(text).toContain("No partner outreach logs or tenant profile changes recorded today.");
  });

  it("formats outreach activities, company changes and next actions", () => {
    const data: DailyOpsDigestData = {
      dateLabel: "Tuesday, Sep 15, 2026",
      prospectActivities: [
        {
          prospectId: "p1",
          name: "Those Amsterdames",
          contactName: "Kendra Borgen",
          status: "emailed",
          nextActionType: "call",
          nextActionDueAt: "2026-09-21T00:00:00Z",
          events: [
            { id: "e1", eventType: "note", body: "[Meeting proposed] Meeting set", createdAt: "2026-09-15T14:15:00Z" },
          ],
        },
      ],
      companyChanges: [
        {
          id: "c1",
          name: "Off Course Amsterdam",
          customDomain: "map.offcourseamsterdam.com",
          reviewPlatform: "tripadvisor",
          updatedAt: "2026-09-15T13:30:00Z",
        },
      ],
    };
    const text = formatDailyOpsDigestSlackMessage(data);
    expect(text).toContain("*Those Amsterdames* (Kendra Borgen)");
    expect(text).toContain("*Off Course Amsterdam*");
    expect(text).toContain("`map.offcourseamsterdam.com`");
    expect(text).toContain("Immediate Priorities / Next Actions");
  });
});

describe("getStartOfDayAmsterdam", () => {
  it("returns a valid Date instance", () => {
    const start = getStartOfDayAmsterdam();
    expect(start).toBeInstanceOf(Date);
    expect(start.getTime()).toBeLessThan(Date.now());
  });
});
