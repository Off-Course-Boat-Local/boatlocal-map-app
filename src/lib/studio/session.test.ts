import { describe, expect, it } from "vitest";

import { actorFromSession, type DevSession } from "./session";

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
