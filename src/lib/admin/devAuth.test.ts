import { describe, expect, it } from "vitest";

import { decodeAdminSession, encodeAdminSession, verifyDevCredentials } from "./devAuth";

// Only the pure helpers are tested here. createAdminSession/destroyAdminSession/
// getAdminSession/requireAdminSession all call next/headers' cookies(), which
// throws outside a request context — they are exercised by hitting the real
// routes, not by importing them into a plain unit test.

describe("verifyDevCredentials", () => {
  it("accepts any non-empty email with the shared dev password", () => {
    expect(verifyDevCredentials("someone@example.com", "boatlocal-dev")).toBe(true);
    expect(verifyDevCredentials("anyone-else@boatlocal.nl", "boatlocal-dev")).toBe(true);
  });

  it("rejects an empty or whitespace-only email even with the right password", () => {
    expect(verifyDevCredentials("", "boatlocal-dev")).toBe(false);
    expect(verifyDevCredentials("   ", "boatlocal-dev")).toBe(false);
  });

  it("rejects the wrong password", () => {
    expect(verifyDevCredentials("someone@example.com", "wrong")).toBe(false);
    expect(verifyDevCredentials("someone@example.com", "")).toBe(false);
  });
});

describe("encodeAdminSession / decodeAdminSession", () => {
  it("round-trips a session", () => {
    const session = { role: "admin" as const, email: "jan@boatlocal.nl" };
    expect(decodeAdminSession(encodeAdminSession(session))).toEqual(session);
  });

  it("returns null for garbage input rather than throwing", () => {
    expect(decodeAdminSession("not-base64url-json")).toBeNull();
    expect(decodeAdminSession("")).toBeNull();
  });

  it("returns null for well-formed but wrong-shaped payloads", () => {
    const notASession = Buffer.from(JSON.stringify({ role: "company", companyId: "1" }), "utf8").toString(
      "base64url",
    );
    expect(decodeAdminSession(notASession)).toBeNull();
  });
});
