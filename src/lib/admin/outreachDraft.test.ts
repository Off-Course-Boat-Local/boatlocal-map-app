// Enforces the outreach copy rules based on Beer's sent emails

import { describe, expect, it } from "vitest";

import type { OutreachProspect } from "@/lib/data/outreach";

import { buildDefaultOutreachDraft, outreachTouchForPriorEmails } from "./outreachDraft";


const baseOperatorDutch: OutreachProspect = {
  id: "p1",
  name: "King Bikes",
  segment: "operator",
  source: "csv",
  website: "kingbikes.nl",
  phone: null,
  email: "info@kingbikes.nl",
  contactName: "Mikael",
  instagramHandle: "@kingbikes",
  instagramFollowers: 125,
  taRating: 4,
  taReviewCount: 125,
  taUrl: null,
  tourType: "Bike Rental & Tours",
  priceFrom: 20,
  yearFounded: 2015,
  languages: "Dutch, English",
  notes: "Contactpersoon: Mikael",
  status: "not_contacted",
  nextActionType: null,
  nextActionDueAt: null,
  lastContactedAt: null,
  companyId: null,
  googlePlaceId: null,
  websiteDomain: "kingbikes.nl",
  createdAt: "2026-09-03T00:00:00Z",
  updatedAt: "2026-09-03T00:00:00Z",
};

const baseOperatorEnglish: OutreachProspect = {
  ...baseOperatorDutch,
  name: "Amsterbike",
  email: "info@amsterbike.nl",
  languages: "English, Spanish",
  contactName: "John",
  notes: null,
};

const bareOperator: OutreachProspect = {
  ...baseOperatorDutch,
  name: "Canal Bikes",
  contactName: null,
  taRating: null,
  taReviewCount: null,
  languages: null,
  yearFounded: null,
  tourType: null,
  notes: null,
};

const hotelDutch: OutreachProspect = {
  ...baseOperatorDutch,
  name: "Hotel V Nesplein",
  segment: "hotel",
  source: "agent",
  contactName: "Priya",
  tourType: null,
  languages: "Dutch, English",
  taRating: 4.7,
  taReviewCount: 2140,
  notes: null,
};

describe("outreachTouchForPriorEmails", () => {
  it("maps the email count to the next touch, capping at the detach email", () => {
    expect(outreachTouchForPriorEmails(0)).toBe(1);
    expect(outreachTouchForPriorEmails(1)).toBe(2);
    expect(outreachTouchForPriorEmails(2)).toBe(3);
    expect(outreachTouchForPriorEmails(7)).toBe(3);
  });
});

describe("buildDefaultOutreachDraft", () => {
  it("generates Dutch copy with social proof for Dutch operators", () => {
    const { subject, body } = buildDefaultOutreachDraft(baseOperatorDutch, { touch: 1 });
    expect(subject).toContain("King Bikes");
    expect(body).toContain("Hi Mikael,");
    expect(body).toContain("Mijn naam is Beer van boatlocal.nl");
    expect(body).toContain("verborgen parels");
    expect(body).toContain("TripAdvisor");
    // Must contain the social proof specified by user:
    expect(body).toContain("Inmiddels werken we al samen met twee andere partijen in Amsterdam");
    expect(body).toContain("volledig gratis");
    expect(body).toContain("15 minuten");
  });

  it("generates English copy with social proof for English operators", () => {
    const { subject, body } = buildDefaultOutreachDraft(baseOperatorEnglish, { touch: 1 });
    expect(subject).toContain("Amsterbike");
    expect(body).toContain("Hi John,");
    expect(body).toContain("My name is Beer Zoomers from boatlocal.nl");
    expect(body).toContain("hidden gems");
    expect(body).toContain("TripAdvisor");
    // Must contain the social proof specified by user:
    expect(body).toContain("We are already working with two other parties in Amsterdam");
    expect(body).toContain("completely free");
    expect(body).toContain("15 minutes");
  });

  it("treats a 'Team' contact name as team greeting, not person's first name", () => {
    const { body } = buildDefaultOutreachDraft({ ...baseOperatorEnglish, contactName: "Amsterbike Team" }, { touch: 1 });
    expect(body.startsWith("Hi Amsterbike team,")).toBe(true);
  });

  it("touch 2 generates a follow-up mentioning preview and two other parties", () => {
    const { body } = buildDefaultOutreachDraft(baseOperatorDutch, { touch: 2 });
    expect(body).toContain("Heb je toevallig al gelegenheid gehad");
    expect(body).toContain("digitale preview voor King Bikes");
    expect(body).toContain("twee andere partijen");
  });

  it("touch 3 generates a friendly detach email", () => {
    const { body } = buildDefaultOutreachDraft(baseOperatorDutch, { touch: 3 });
    expect(body).toContain("geen prioriteit");
    expect(body).toContain("parkeren");
  });

  it("supports hotel segment with custom guest map copy and social proof", () => {
    const { body } = buildDefaultOutreachDraft(hotelDutch, { touch: 1 });
    expect(body).toContain("digitale gastenkaart");
    expect(body).toContain("Hotel V Nesplein");
    expect(body).toContain("QR-code");
    expect(body).toContain("Inmiddels werken we al samen met twee andere partijen in Amsterdam");
  });
});

