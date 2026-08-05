// Pure colour helpers for the Studio Branding form.
//
// PRD §7.2 only asks for two pickers — primary and accent — but
// CompanyRecord (see src/lib/data/types.ts, mirroring the `companies`
// table) also carries a `brandPrimaryDark` column, used for hover/pressed
// states across the guest app (see src/lib/brand.ts's five seed brands, each
// of which pairs a primary with a hand-picked darker shade). Rather than add
// a third picker the PRD never asked for, darkenHex() derives it
// automatically from whatever primary the user picks. This is a v1
// simplification: it will not exactly reproduce a designer's hand-picked
// primaryDark (see the tests for how close it lands on the seeded brands),
// but it always yields a valid, visibly-darker shade, which is all a hover
// state needs.

/** True for `#rgb` or `#rrggbb` (case-insensitive), the two forms every hex `<input>` and swatch in this app produces. */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** Normalizes `#rgb` to `#rrggbb`. Assumes isValidHexColor(value) already passed. */
function expandHex(hex: string): string {
  const raw = hex.trim().slice(1);
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  return `#${raw}`.toLowerCase();
}

/**
 * Darkens a hex colour by `amount` (0–1, fraction of each channel removed).
 * Falls back to the input unchanged if it isn't a valid hex colour, so a
 * mid-edit/invalid value never throws — the caller decides whether to block
 * saving on validity, this just never crashes the live preview.
 */
export function darkenHex(hex: string, amount: number = 0.3): string {
  if (!isValidHexColor(hex)) return hex;
  const clampedAmount = Math.min(1, Math.max(0, amount));
  const full = expandHex(hex);
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);

  const darken = (channel: number) =>
    Math.round(channel * (1 - clampedAmount))
      .toString(16)
      .padStart(2, "0");

  return `#${darken(r)}${darken(g)}${darken(b)}`;
}
