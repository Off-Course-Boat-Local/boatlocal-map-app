import { describe, expect, it } from "vitest";

import {
  actorFromSession,
  parseSessionCookie,
  serializeSession,
  type DevSession,
} from "./session";

const companySession: DevSession = {
  role: "company",
  email: "owner@example.com",
  companyId: "company-1",
  companyName: "Boat & Bike Co.",
};

const guideSession: DevSession = {
  role: "guide",
  email: "jan@example.com",
  companyId: "company-1",
  companyName: "Boat & Bike Co.",
  guideId: "guide-1",
  guideName: "Jan",
};

describe("session cookie roundtrip", () => {
  it("roundtrips a company session", () => {
    expect(parseSessionCookie(serializeSession(companySession))).toEqual(companySession);
  });

  it("roundtrips a guide session", () => {
    expect(parseSessionCookie(serializeSession(guideSession))).toEqual(guideSession);
  });
});

describe("parseSessionCookie — malformed / hostile input", () => {
  it("returns null for undefined, null and empty string", () => {
    expect(parseSessionCookie(undefined)).toBeNull();
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie("")).toBeNull();
  });

  it("returns null for a value that is not valid JSON", () => {
    expect(parseSessionCookie("not-json-at-all")).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseSessionCookie(encodeURIComponent(JSON.stringify("just a string")))).toBeNull();
    expect(parseSessionCookie(encodeURIComponent(JSON.stringify(42)))).toBeNull();
  });

  it("returns null for an unrecognised role", () => {
    const tampered = encodeURIComponent(
      JSON.stringify({ role: "admin", email: "x@x.com", companyId: "c1", companyName: "X" }),
    );
    expect(parseSessionCookie(tampered)).toBeNull();
  });

  it("returns null for a guide session missing guideId/guideName", () => {
    const tampered = encodeURIComponent(
      JSON.stringify({ role: "guide", email: "x@x.com", companyId: "c1", companyName: "X" }),
    );
    expect(parseSessionCookie(tampered)).toBeNull();
  });

  it("returns null when a common field is missing", () => {
    const tampered = encodeURIComponent(JSON.stringify({ role: "company", email: "x@x.com" }));
    expect(parseSessionCookie(tampered)).toBeNull();
  });
});

describe("actorFromSession", () => {
  it("maps a company session to a company StudioActor", () => {
    expect(actorFromSession(companySession)).toEqual({
      role: "company",
      companyId: "company-1",
    });
  });

  it("maps a guide session to a guide StudioActor, carrying both ids", () => {
    expect(actorFromSession(guideSession)).toEqual({
      role: "guide",
      companyId: "company-1",
      guideId: "guide-1",
    });
  });
});
