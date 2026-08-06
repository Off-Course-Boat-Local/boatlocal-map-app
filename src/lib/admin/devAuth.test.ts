import { afterEach, describe, expect, it } from "vitest";

import { isEmailAllowlistedForAdmin } from "./allowlist";

// Only the pure allowlist-parsing helper is tested here, imported from
// ./allowlist rather than ./devAuth — devAuth.ts pulls in the
// `server-only`-guarded Supabase clients (src/lib/supabase/server.ts,
// src/lib/supabase/admin.ts), and under Vitest (plain Node, no Next.js
// "react-server" resolve condition) importing anything in that chain
// always throws, guard-condition or not. getAdminSession /
// requireAdminSession / destroyAdminSession are exercised by hitting the
// real routes, not by importing them into a plain unit test.

const ORIGINAL_ENV = process.env.ADMIN_ALLOWED_EMAILS;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.ADMIN_ALLOWED_EMAILS;
  } else {
    process.env.ADMIN_ALLOWED_EMAILS = ORIGINAL_ENV;
  }
});

describe("isEmailAllowlistedForAdmin", () => {
  it("returns false when the allowlist is unset (fail closed)", () => {
    delete process.env.ADMIN_ALLOWED_EMAILS;
    expect(isEmailAllowlistedForAdmin("jan@boatlocal.nl")).toBe(false);
  });

  it("returns false when the allowlist is empty", () => {
    process.env.ADMIN_ALLOWED_EMAILS = "";
    expect(isEmailAllowlistedForAdmin("jan@boatlocal.nl")).toBe(false);
  });

  it("accepts an exact match from a comma-separated list", () => {
    process.env.ADMIN_ALLOWED_EMAILS = "jan@boatlocal.nl,ops@boatlocal.nl";
    expect(isEmailAllowlistedForAdmin("jan@boatlocal.nl")).toBe(true);
    expect(isEmailAllowlistedForAdmin("ops@boatlocal.nl")).toBe(true);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    process.env.ADMIN_ALLOWED_EMAILS = " Jan@BoatLocal.nl , ops@boatlocal.nl ";
    expect(isEmailAllowlistedForAdmin("jan@boatlocal.nl")).toBe(true);
    expect(isEmailAllowlistedForAdmin("  OPS@boatlocal.NL  ")).toBe(true);
  });

  it("rejects anyone not on the list", () => {
    process.env.ADMIN_ALLOWED_EMAILS = "jan@boatlocal.nl";
    expect(isEmailAllowlistedForAdmin("someone-else@example.com")).toBe(false);
  });
});
