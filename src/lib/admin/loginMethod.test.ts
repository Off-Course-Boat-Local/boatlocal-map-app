import { describe, expect, it } from "vitest";

import { decideAdminLoginMode } from "./loginMethod";

// Only the pure decision table is tested here, same reasoning as
// devAuth.test.ts: the real allowlist + password_set lookup
// (src/lib/admin/passwordStatus.ts) pulls in `server-only`-guarded Supabase
// clients that always throw under plain Vitest, so it's exercised by
// hitting the real routes/actions, not imported into a unit test.

describe("decideAdminLoginMode", () => {
  it("is magic-link when the email isn't allowlisted at all, password_set or not", () => {
    expect(decideAdminLoginMode({ allowlisted: false, passwordSet: false })).toBe("magic-link");
    expect(decideAdminLoginMode({ allowlisted: false, passwordSet: true })).toBe("magic-link");
  });

  it("is magic-link when allowlisted but no password has ever been set", () => {
    expect(decideAdminLoginMode({ allowlisted: true, passwordSet: false })).toBe("magic-link");
  });

  it("is password only when allowlisted AND password_set is true", () => {
    expect(decideAdminLoginMode({ allowlisted: true, passwordSet: true })).toBe("password");
  });

  it("never returns 'password' for a non-allowlisted email, even if passwordSet were somehow true", () => {
    // Shouldn't be reachable in practice (passwordStatus.ts's lookup is
    // gated on allowlisted first), but the decision table itself must still
    // fail closed if ever called with this combination directly.
    expect(decideAdminLoginMode({ allowlisted: false, passwordSet: true })).not.toBe("password");
  });
});
