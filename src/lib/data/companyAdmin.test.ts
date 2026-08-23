// Admin Companies onboarding (PRD §8.3) — createCompany / setCompanyStatus.
// Kept in its own file rather than appended to source.test.ts to avoid
// churn on that already-large shared test file; same conventions
// (resetFakeStore in beforeEach, StudioActor literals, StudioPermissionError
// assertions) as the tests there.

import { beforeEach, describe, expect, it } from "vitest";

import { resetFakeStore } from "./fakeStore";
import { createCompany, listCompanies, setCompanyStatus } from "./source";
import { StudioPermissionError } from "./types";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  resetFakeStore();
});

describe("createCompany", () => {
  it("only admin may onboard a new company", async () => {
    await expect(
      createCompany(
        { role: "company", companyId: COMPANY_ID },
        { name: "New Co", companyType: "hotel", ownerEmail: "owner@newco.example" },
      ),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("creates a company defaulting to setup status and a slugified subdomain from the name", async () => {
    const company = await createCompany(
      { role: "admin" },
      { name: "Hotel V Nesplein", companyType: "hotel", ownerEmail: "owner@hotelv.example" },
    );

    expect(company.status).toBe("setup");
    expect(company.subdomain).toBe("hotel-v-nesplein");
    expect(company.companyType).toBe("hotel");
    expect(company.appName).toBe("Hotel V Nesplein");
    expect(company.ownerEmail).toBe("owner@hotelv.example");
    expect(company.ownerStatus).toBe("invited");

    const all = await listCompanies({ role: "admin" });
    expect(all.some((c) => c.id === company.id)).toBe(true);
  });

  it("slugifies an explicitly provided subdomain", async () => {
    const company = await createCompany(
      { role: "admin" },
      {
        name: "Canal Tours XL",
        subdomain: "Canal Tours!!",
        companyType: "tour",
        ownerEmail: "owner@canaltours.example",
      },
    );
    expect(company.subdomain).toBe("canal-tours");
  });

  it("always starts a new company in 'setup', regardless of who creates it — Admin no longer picks an initial status", async () => {
    const company = await createCompany(
      { role: "admin" },
      { name: "Jordaan B&B", companyType: "host", ownerEmail: "owner@jordaanbb.example" },
    );
    expect(company.status).toBe("setup");
  });

  it("companyType is optional and free text — no fixed vocabulary any more", async () => {
    const company = await createCompany(
      { role: "admin" },
      { name: "No Type Co", ownerEmail: "owner@notype.example" },
    );
    expect(company.companyType).toBeNull();

    const withType = await createCompany(
      { role: "admin" },
      { name: "Wine Bar Co", companyType: "Bar", ownerEmail: "owner@winebar.example" },
    );
    expect(withType.companyType).toBe("Bar");
  });

  it("rejects a blank company name", async () => {
    await expect(
      createCompany(
        { role: "admin" },
        { name: "   ", companyType: "hotel", ownerEmail: "owner@example.com" },
      ),
    ).rejects.toThrow(/name/i);
  });

  it("rejects a blank owner email", async () => {
    await expect(
      createCompany(
        { role: "admin" },
        { name: "No Owner Co", companyType: "hotel", ownerEmail: "   " },
      ),
    ).rejects.toThrow(/owner email/i);
  });

  it("rejects a subdomain already used by another company", async () => {
    await expect(
      createCompany(
        { role: "admin" },
        {
          name: "Duplicate Co",
          subdomain: "coastal",
          companyType: "host",
          ownerEmail: "owner@duplicateco.example",
        },
      ),
    ).rejects.toThrow(/already in use/i);
  });

  it("rejects a reserved subdomain (see src/lib/slug.ts RESERVED_SUBDOMAINS)", async () => {
    await expect(
      createCompany(
        { role: "admin" },
        { name: "Sneaky Co", subdomain: "admin", companyType: "host", ownerEmail: "owner@sneakyco.example" },
      ),
    ).rejects.toThrow(/reserved/i);
  });
});

describe("setCompanyStatus", () => {
  it("a company may publish (setup -> active) and unpublish (active -> setup) itself", async () => {
    const companyActor = { role: "company" as const, companyId: COMPANY_ID };

    const live = await setCompanyStatus(companyActor, COMPANY_ID, "active");
    expect(live.status).toBe("active");

    const unpublished = await setCompanyStatus(companyActor, COMPANY_ID, "setup");
    expect(unpublished.status).toBe("setup");
  });

  it("a company may not suspend itself", async () => {
    await expect(
      setCompanyStatus({ role: "company", companyId: COMPANY_ID }, COMPANY_ID, "suspended"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("a company may not reactivate itself out of 'suspended'", async () => {
    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");
    await expect(
      setCompanyStatus({ role: "company", companyId: COMPANY_ID }, COMPANY_ID, "active"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("a company may not change another company's status", async () => {
    await expect(
      setCompanyStatus({ role: "company", companyId: "some-other-company" }, COMPANY_ID, "active"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("a guide may not change any company's status", async () => {
    await expect(
      setCompanyStatus({ role: "guide", companyId: COMPANY_ID, guideId: "g1" }, COMPANY_ID, "active"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("flips an existing company's status", async () => {
    const updated = await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");
    expect(updated.status).toBe("suspended");

    const [again] = await listCompanies({ role: "admin" });
    expect(again.status).toBe("suspended");
  });

  it("throws for an unknown company id", async () => {
    await expect(
      setCompanyStatus({ role: "admin" }, "not-a-real-company", "active"),
    ).rejects.toThrow(StudioPermissionError);
  });
});
