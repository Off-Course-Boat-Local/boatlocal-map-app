// Company "welcome copy" — a Branding-page field with nowhere real to live
// yet.
//
// PRD §7.2 only lists logo/colour/app-name, but the product brief for this
// task also asks for a welcome-copy field on the Branding page (shown to a
// guest on first open, distinct from a guide's own `welcomeMessage` on
// GuideRecord — see src/lib/data/types.ts). The `companies` table
// (supabase/migrations/20260805063610_init_schema.sql) and CompanyRecord
// have no column for this today, and this task is scoped to reuse the
// existing data schema, not extend it. So, deliberately, this one field
// persists to localStorage only — a real column (e.g. `welcome_copy`) and a
// matching `UpdateCompanyBrandingInput.welcomeCopy` would need to land in a
// follow-up before BrandingForm's Save button can send it to
// updateCompanyBranding() alongside the rest of the form.
//
// Every other Branding field (app name, colours, logo) goes through the
// real save path — src/lib/studio/brandingActions.ts calling
// updateCompanyBranding(), which writes into the fake store today and is
// itself commented as the TODO for the eventual Supabase call.
//
// SSR-safe: every read/write no-ops on the server (no `window`), matching
// the pattern in src/lib/savedPlaces.ts.

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Namespaced per company so a future multi-tenant-in-one-browser dev setup does not bleed drafts across companies. */
function storageKey(companyId: string): string {
  return `boatlocal:studio:welcome-copy-draft:v1:${companyId}`;
}

/** Reads the saved draft for a company, or "" if nothing has been saved yet (or on the server). */
export function getWelcomeCopyDraft(companyId: string): string {
  if (!isBrowser()) return "";
  try {
    return window.localStorage.getItem(storageKey(companyId)) ?? "";
  } catch {
    // Corrupt/unavailable storage (e.g. Safari private mode quirks) should
    // degrade to "no draft", never throw and break the Branding page.
    return "";
  }
}

/** Persists the draft for a company. Empty string clears the key rather than storing an empty value. */
export function setWelcomeCopyDraft(companyId: string, welcomeCopy: string): void {
  if (!isBrowser()) return;
  try {
    if (welcomeCopy.trim().length === 0) {
      window.localStorage.removeItem(storageKey(companyId));
    } else {
      window.localStorage.setItem(storageKey(companyId), welcomeCopy);
    }
  } catch {
    // Best-effort only — a failed local draft save should never block the
    // rest of the form's Save action.
  }
}
