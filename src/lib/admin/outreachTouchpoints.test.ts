import { describe, expect, it } from "vitest";

import {
  formatLastContact,
  formatRelativeDate,
  parseOutreachEvent,
} from "./outreachTouchpoints";

describe("outreachTouchpoints", () => {
  describe("parseOutreachEvent", () => {
    it("parses [WhatsApp] prefix cleanly", () => {
      const parsed = parseOutreachEvent({
        eventType: "note",
        body: "[WhatsApp] Sent brochure and app link to +34 600 000 000",
        createdAt: "2026-09-10T10:00:00Z",
      });

      expect(parsed.channel).toBe("whatsapp");
      expect(parsed.meta.badgeLabel).toBe("WhatsApp");
      expect(parsed.cleanBody).toBe("Sent brochure and app link to +34 600 000 000");
    });

    it("parses [Meeting proposed] prefix cleanly", () => {
      const parsed = parseOutreachEvent({
        eventType: "note",
        body: "[Meeting proposed] Demo on Friday at 14:00 with Captain Marco",
        createdAt: "2026-09-10T10:00:00Z",
      });

      expect(parsed.channel).toBe("meeting_proposed");
      expect(parsed.meta.badgeLabel).toBe("Meeting proposed");
      expect(parsed.cleanBody).toBe("Demo on Friday at 14:00 with Captain Marco");
    });

    it("parses [Meeting held] prefix cleanly", () => {
      const parsed = parseOutreachEvent({
        eventType: "note",
        body: "[Meeting held] Walked through affiliate portal; enthusiastic",
        createdAt: "2026-09-10T10:00:00Z",
      });

      expect(parsed.channel).toBe("meeting_held");
      expect(parsed.meta.badgeLabel).toBe("Meeting held");
      expect(parsed.cleanBody).toBe("Walked through affiliate portal; enthusiastic");
    });

    it("parses [In person] prefix cleanly", () => {
      const parsed = parseOutreachEvent({
        eventType: "note",
        body: "[In person] Dropped by marina desk, spoke to reception",
        createdAt: "2026-09-10T10:00:00Z",
      });

      expect(parsed.channel).toBe("in_person");
      expect(parsed.meta.badgeLabel).toBe("In person");
      expect(parsed.cleanBody).toBe("Dropped by marina desk, spoke to reception");
    });

    it("parses native call_logged and email_sent without prefixes", () => {
      const call = parseOutreachEvent({
        eventType: "call_logged",
        body: "Left voicemail",
        createdAt: "2026-09-10T10:00:00Z",
      });
      expect(call.channel).toBe("call");
      expect(call.cleanBody).toBe("Left voicemail");

      const email = parseOutreachEvent({
        eventType: "email_sent",
        body: "Subject: Partnership",
        createdAt: "2026-09-10T10:00:00Z",
      });
      expect(email.channel).toBe("email");
    });

    it("parses lifecycle events correctly", () => {
      const replied = parseOutreachEvent({
        eventType: "replied",
        body: "Interested in getting started",
        createdAt: "2026-09-10T10:00:00Z",
      });
      expect(replied.channel).toBe("replied");

      const declined = parseOutreachEvent({
        eventType: "declined",
        body: "Not right now",
        createdAt: "2026-09-10T10:00:00Z",
      });
      expect(declined.channel).toBe("declined");

      const onboarded = parseOutreachEvent({
        eventType: "onboarded",
        body: null,
        createdAt: "2026-09-10T10:00:00Z",
      });
      expect(onboarded.channel).toBe("onboarded");
    });
  });

  describe("formatRelativeDate", () => {
    const fixedNow = new Date("2026-09-10T15:00:00Z").getTime();

    it("identifies Today", () => {
      expect(formatRelativeDate("2026-09-10T09:00:00Z", fixedNow)).toBe("Today");
    });

    it("identifies Yesterday", () => {
      expect(formatRelativeDate("2026-09-09T14:00:00Z", fixedNow)).toBe("Yesterday");
    });

    it("identifies days ago within a week", () => {
      expect(formatRelativeDate("2026-09-07T10:00:00Z", fixedNow)).toBe("3d ago");
    });
  });

  describe("formatLastContact", () => {
    const fixedNow = new Date("2026-09-10T15:00:00Z").getTime();

    it("returns null when no contact info or events", () => {
      expect(formatLastContact(null, [], fixedNow)).toBeNull();
    });

    it("formats WhatsApp touchpoint summary with snippet", () => {
      const summary = formatLastContact(
        "2026-09-09T12:00:00Z",
        [
          {
            eventType: "note",
            body: "[WhatsApp] Sent guest app demo link to Carlos",
            createdAt: "2026-09-09T12:00:00Z",
          },
        ],
        fixedNow,
      );

      expect(summary).not.toBeNull();
      expect(summary?.channel).toBe("whatsapp");
      expect(summary?.label).toBe("WhatsApp");
      expect(summary?.relativeTime).toBe("Yesterday");
      expect(summary?.text).toBe("WhatsApp (Yesterday)");
      expect(summary?.snippet).toBe("Sent guest app demo link to Carlos");
      expect(summary?.isMeetingProposed).toBe(false);
    });

    it("formats Meeting proposed touchpoint with isMeetingProposed flag", () => {
      const summary = formatLastContact(
        "2026-09-10T11:00:00Z",
        [
          {
            eventType: "note",
            body: "[Meeting proposed] Friday at 14:00 at marina office",
            createdAt: "2026-09-10T11:00:00Z",
          },
        ],
        fixedNow,
      );

      expect(summary).not.toBeNull();
      expect(summary?.channel).toBe("meeting_proposed");
      expect(summary?.label).toBe("Meeting proposed");
      expect(summary?.relativeTime).toBe("Today");
      expect(summary?.text).toBe("Meeting proposed (Today)");
      expect(summary?.isMeetingProposed).toBe(true);
    });

    it("falls back to generic Contacted when only lastContactedAt is known", () => {
      const summary = formatLastContact("2026-09-07T10:00:00Z", [], fixedNow);
      expect(summary).not.toBeNull();
      expect(summary?.label).toBe("Contacted");
      expect(summary?.relativeTime).toBe("3d ago");
    });
  });
});
