// Guide name -> URL slug (PRD §6.2: "auto-generated unique link... slug
// from the name", e.g. hotelv.app.boatlocal.nl/jan). Pure, dependency-free,
// used by inviteGuide (src/lib/data/source.ts) so the invite flow never has
// to ask the company to type a slug by hand.

/**
 * Lowercases, strips diacritics, and collapses anything that isn't a-z0-9
 * into single hyphens. Never returns an empty string — "guide" is the
 * fallback for a name with no latin letters at all (e.g. all-emoji).
 *
 * @example slugify("Jan") // "jan"
 * @example slugify("Marie-Ève") // "marie-eve"
 * @example slugify("  ") // "guide"
 */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics after NFD split
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "guide";
}

/**
 * `slugify(name)`, disambiguated against a set of slugs already taken in
 * the same company (slugs are unique per company, not globally — see the
 * `unique (company_id, slug)` constraint on public.guides). Appends -2, -3,
 * … until free.
 *
 * @example uniqueSlug("Jan", ["jan"]) // "jan-2"
 */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const base = slugify(name);
  if (!takenSet.has(base)) return base;

  let n = 2;
  while (takenSet.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * First letter of the first word, uppercased — the fallback avatar shown
 * until a guide uploads a real photo. "?" for a name with no letters at all.
 *
 * @example initialFromName("Jan") // "J"
 */
export function initialFromName(name: string): string {
  const letter = name.trim().match(/[\p{L}\p{N}]/u)?.[0];
  return letter ? letter.toUpperCase() : "?";
}

// ---------------------------------------------------------------------------
// Company subdomain validation (PRD §8.1 "onboard a company (+ assign
// subdomain)" / §13.1: the subdomain becomes the literal DNS label in
// `{subdomain}.app.boatlocal.nl`). Separate from the guide-slug helpers
// above: a guide slug only has to be unique within one company and is
// always auto-derived, never typed in; a company subdomain is a real DNS
// label an admin chooses deliberately, must be globally unique, and must
// never silently change if a name collides (unlike uniqueSlug's -2/-3
// suffixing) — a wrong subdomain is a wrong public URL, not a cosmetic
// collision, so createCompany (src/lib/data/source.ts) rejects a taken one
// outright rather than picking a different one for the admin.

/**
 * DNS-label-safe check: lowercase letters/digits/hyphens only, 1-63 chars,
 * can't start or end with a hyphen. Intentionally stricter than slugify's
 * output filter (which would happily emit a >63-char string) since this
 * validates admin-typed input rather than transforming it.
 *
 * @example isUrlSafeSubdomain("hotelv") // true
 * @example isUrlSafeSubdomain("-hotelv") // false
 * @example isUrlSafeSubdomain("Hotel V") // false
 */
export function isUrlSafeSubdomain(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

/**
 * Labels that must never be handed out as a company subdomain because they
 * either collide with Boat Local's own fixed hosts (PRD §13.1: Admin/Studio
 * live on `admin.boatlocal.nl` / `studio.boatlocal.nl`, not the tenant
 * wildcard) or are common enough to cause confusion (`www`, `api`, the
 * wildcard's own `app` label).
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "admin",
  "studio",
  "app",
  "api",
  "www",
  "boatlocal",
]);
