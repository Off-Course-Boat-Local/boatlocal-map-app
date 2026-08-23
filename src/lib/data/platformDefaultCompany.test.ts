// Platform-default company (src/lib/data/source.ts's getPlatformDefaultCompany/
// setPlatformDefaultCompany/unsetPlatformDefaultCompany) — the guest-side
// fallback fix in src/lib/guestServerContext.ts for a visitor with no
// `?company=` at all. Kept in its own file rather than appended to
// source.test.ts, same reasoning as companyAdmin.test.ts's own header
// comment (avoid churn on that already-large shared test file); same
// conventions (resetFakeStore in beforeEach, StudioActor literals,
// StudioPermissionError assertions).

import { beforeEach, describe, expect, it } from "vitest";

import { fakeStore, resetFakeStore } from "./fakeStore";
import {
  createCompany,
  getPlatformDefaultCompany,
  setPlatformDefaultCompany,
  unsetPlatformDefaultCompany,
} from "./source";
import { StudioPermissionError } from "./types";

const SEEDED_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  resetFakeStore();
});

describe("getPlatformDefaultCompany", () => {
  it("returns null when no company has been flagged yet (fresh install)", async () => {
    expect(await getPlatformDefaultCompany()).toBeNull();
  });

  it("returns the flagged company once one has been set", async () => {
    await setPlatformDefaultCompany({ role: "admin" }, SEEDED_COMPANY_ID);

    const result = await getPlatformDefaultCompany();
    expect(result?.id).toBe(SEEDED_COMPANY_ID);
  });

  it("returns the flagged company regardless of its status (Admin needs to manage it even mid-setup)", async () => {
    const created = await createCompany(
      { role: "admin" },
      { name: "Boat Local", ownerEmail: "owner@boatlocal.example" },
    );
    expect(created.status).toBe("setup");

    await setPlatformDefaultCompany({ role: "admin" }, created.id);

    const result = await getPlatformDefaultCompany();
    expect(result?.id).toBe(created.id);
    expect(result?.status).toBe("setup");
  });
});

describe("setPlatformDefaultCompany", () => {
  it("only admin may set the platform default company", async () => {
    await expect(
      setPlatformDefaultCompany({ role: "company", companyId: SEEDED_COMPANY_ID }, SEEDED_COMPANY_ID),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("throws for an unknown company id", async () => {
    await expect(
      setPlatformDefaultCompany({ role: "admin" }, "not-a-real-company"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("at most one company can be flagged at a time — setting a new one clears the old holder", async () => {
    const second = await createCompany(
      { role: "admin" },
      { name: "Second Co", ownerEmail: "owner@second.example" },
    );

    await setPlatformDefaultCompany({ role: "admin" }, SEEDED_COMPANY_ID);
    expect((await getPlatformDefaultCompany())?.id).toBe(SEEDED_COMPANY_ID);

    await setPlatformDefaultCompany({ role: "admin" }, second.id);
    expect((await getPlatformDefaultCompany())?.id).toBe(second.id);

    // Only one company's flag survives — not both.
    expect(fakeStore.platformDefaultCompanyId).toBe(second.id);
  });
});

describe("unsetPlatformDefaultCompany", () => {
  it("only admin may unset the platform default company", async () => {
    await setPlatformDefaultCompany({ role: "admin" }, SEEDED_COMPANY_ID);
    await expect(
      unsetPlatformDefaultCompany({ role: "guide", companyId: SEEDED_COMPANY_ID, guideId: "g1" }),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("clears the flag, returning to the fresh-install state", async () => {
    await setPlatformDefaultCompany({ role: "admin" }, SEEDED_COMPANY_ID);
    expect(await getPlatformDefaultCompany()).not.toBeNull();

    await unsetPlatformDefaultCompany({ role: "admin" });
    expect(await getPlatformDefaultCompany()).toBeNull();
  });

  it("is a no-op when nothing is flagged", async () => {
    await expect(unsetPlatformDefaultCompany({ role: "admin" })).resolves.not.toThrow();
  });
});
