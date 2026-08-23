// Guide name -> URL slug (PRD §6.2: "auto-generated unique link... slug
// from the name", e.g. hotelv.map.boatlocal.nl/jan). Pure, dependency-free,
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
