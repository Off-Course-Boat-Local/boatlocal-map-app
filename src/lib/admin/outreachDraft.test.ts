// Enforces the mechanical rules in docs/outreach-voice.md so the drafts
// can't drift back into machine-sounding copy without a test going red.

import { describe, expect, it } from "vitest";

import type { OutreachProspect } from "@/lib/data/outreach";

import { buildDefaultOutreachDraft, outreachTouchForPriorEmails } from "./outreachDraft";

const base: OutreachProspect = {
  id: "p1",
  name: "360 Amsterdam Tours",
  segment: "operator",
  source: "csv",
  website: "360amsterdamtours.com",
  phone: null,
  email: "support@360amsterdamtours.com",
  contactName: "Anja Herrmann",
  instagramHandle: "@360amsterdam",
  instagramFollowers: 1488,
  taRating: 5,
  taReviewCount: 16096,
  taUrl: null,
  tourType: "Private & Group Walking",
  priceFrom: 32.5,
  yearFounded: 2014,
  languages: "English, Spanish, Italian, German, Portuguese, French, Dutch",
  notes: "Team 4 staff · Booking via: Viator, Own site",
  status: "not_contacted",
  nextActionType: null,
  nextActionDueAt: null,
  lastContactedAt: null,
  companyId: null,
  googlePlaceId: null,
  websiteDomain: "360amsterdamtours.com",
  createdAt: "2026-09-03T00:00:00Z",
  updatedAt: "2026-09-03T00:00:00Z",
};

const bare: OutreachProspect = {
  ...base,
  name: "Canal Bikes",
  contactName: null,
  taRating: null,
  taReviewCount: null,
  languages: null,
  yearFounded: null,
  tourType: null,
  notes: null,
};

const hotel: OutreachProspect = {
  ...base,
  name: "Hotel V Nesplein",
  segment: "hotel",
  source: "agent",
  contactName: "Priya",
  tourType: null,
  languages: "English, Dutch",
  taRating: 4.7,
  taReviewCount: 2140,
  notes: null,
};

const bareHotel: OutreachProspect = { ...hotel, contactName: null, taRating: null, taReviewCount: null };

const words = (s: string) => s.trim().split(/\s+/).length;

// From docs/outreach-voice.md "Banned". Checked case-insensitively against
// the whole body, so a future rewrite can't sneak one in.
const BANNED = [
  "i hope this finds you well",
  "hope you're doing well",
  "i'm reaching out",
  "i wanted to reach out",
  "my name is",
  "just checking in",
  "checking in",
  "circling back",
  "touching base",
  "following up",
  "as mentioned",
  "i'd love to",
  "we'd love to",
  "feel free",
  "leverage",
  "synergy",
  "streamline",
  "optimize",
  "seamless",
  "unlock",
  "empower",
  "elevate",
  "referral channel",
  "commission stack",
  "exciting",
  "amazing",
  "game-changer",
  "win-win",
  "delve",
  "landscape",
  "tapestry",
  "testament",
  "pivotal",
  "showcase",
  "vibrant",
  "genuinely",
  "quick call",
  "hop on a call",
  "15 minutes",
  "30 minutes",
  "!",
];

describe("outreachTouchForPriorEmails", () => {
  it("maps the email count to the next touch, capping at the detach email", () => {
    expect(outreachTouchForPriorEmails(0)).toBe(1);
    expect(outreachTouchForPriorEmails(1)).toBe(2);
    expect(outreachTouchForPriorEmails(2)).toBe(3);
    expect(outreachTouchForPriorEmails(7)).toBe(3);
  });
});

describe("buildDefaultOutreachDraft", () => {
  it("keeps the same subject on every touch so mail clients thread the sequence", () => {
    const subjects = ([1, 2, 3] as const).map((touch) => buildDefaultOutreachDraft(base, { touch }).subject);
    expect(new Set(subjects).size).toBe(1);
    expect(subjects[0].split(" ").length).toBeLessThanOrEqual(3);
    expect(subjects[0]).not.toMatch(/[?!.:]/);
  });

  it("first email: 40–80 words, one question, addressed by first name", () => {
    const { body } = buildDefaultOutreachDraft(base, { touch: 1 });
    expect(words(body)).toBeGreaterThanOrEqual(40);
    expect(words(body)).toBeLessThanOrEqual(80);
    expect((body.match(/\?/g) ?? []).length).toBe(1);
    expect(body.startsWith("Hi Anja,")).toBe(true);
  });

  it("first email: opens with a fact about them, states the offer with a 'without'", () => {
    const { body } = buildDefaultOutreachDraft(base, { touch: 1 });
    expect(body).toContain("16,096 reviews at 5 stars");
    expect(body).toContain("seven languages");
    expect(body).toContain("walking tours");
    expect(body).toMatch(/without an OTA/);
  });

  it("first follow-up: 25–50 words, a new angle, no recap of the first email", () => {
    const first = buildDefaultOutreachDraft(base, { touch: 1 }).body;
    const { body } = buildDefaultOutreachDraft(base, { touch: 2 });
    expect(words(body)).toBeGreaterThanOrEqual(25);
    expect(words(body)).toBeLessThanOrEqual(50);
    expect(body).not.toContain("lobby QR");
    expect(body).toContain("Viator");
    expect(body).not.toBe(first);
  });

  it("first follow-up without OTA data asks the illumination question instead", () => {
    const { body } = buildDefaultOutreachDraft(bare, { touch: 2 });
    expect(body).toMatch(/no obvious way to find Canal Bikes/i);
    expect(body).not.toContain("20–30%");
  });

  it("last follow-up: under 30 words, one neutral yes/no question", () => {
    const { body } = buildDefaultOutreachDraft(base, { touch: 3 });
    expect(words(body)).toBeLessThanOrEqual(30);
    expect(body).toContain("decided against");
    expect((body.match(/\?/g) ?? []).length).toBe(1);
  });

  it("never invents a specific: a prospect with no enrichment gets no fact line", () => {
    const { body } = buildDefaultOutreachDraft(bare, { touch: 1 });
    expect(body.startsWith("Hi,")).toBe(true);
    expect(body).not.toMatch(/stars|reviews|languages|since \d{4}/);
    expect(words(body)).toBeLessThanOrEqual(80);
  });

  it("treats a 'Team' contact name as nobody, not as a first name", () => {
    const { body } = buildDefaultOutreachDraft({ ...base, contactName: "SANDEMANs Team" }, { touch: 1 });
    expect(body.startsWith("Hi,")).toBe(true);
  });

  it("uses their word for the tour type", () => {
    expect(buildDefaultOutreachDraft({ ...base, tourType: "Group Bike" }).body).toContain("bike tours");
    expect(buildDefaultOutreachDraft({ ...base, tourType: "Group Food Walking" }).body).toContain("food tours");
  });

  it.each([1, 2, 3] as const)("touch %i contains none of the banned phrases", (touch) => {
    for (const prospect of [base, bare, hotel, bareHotel]) {
      const body = buildDefaultOutreachDraft(prospect, { touch }).body.toLowerCase();
      for (const phrase of BANNED) {
        expect(body, `touch ${touch} contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  describe("hotel segment", () => {
    it("first email: pitches the gift, not distribution — no OTA/commission language", () => {
      const { body } = buildDefaultOutreachDraft(hotel, { touch: 1 });
      expect(words(body)).toBeLessThanOrEqual(80);
      expect(body).toMatch(/free guest-discovery app/);
      expect(body).toContain("2,140 reviews at 4.7 stars");
      expect(body).not.toMatch(/OTA|commission|25%/);
    });

    it("first email with no enrichment gets no fact line", () => {
      const { body } = buildDefaultOutreachDraft(bareHotel, { touch: 1 });
      expect(body).not.toMatch(/stars|reviews/);
    });

    it("first follow-up: a different angle than touch 1, still one question", () => {
      const first = buildDefaultOutreachDraft(hotel, { touch: 1 }).body;
      const { body } = buildDefaultOutreachDraft(hotel, { touch: 2 });
      expect(words(body)).toBeGreaterThanOrEqual(15);
      expect(words(body)).toBeLessThanOrEqual(50);
      expect(body).not.toBe(first);
      expect(body).toMatch(/first afternoon/);
      expect((body.match(/\?/g) ?? []).length).toBe(1);
    });

    it("last follow-up is the same detach shape as an operator's", () => {
      const { body } = buildDefaultOutreachDraft(hotel, { touch: 3 });
      expect(body).toContain("Hotel V Nesplein");
      expect(words(body)).toBeLessThanOrEqual(30);
    });
  });
});
