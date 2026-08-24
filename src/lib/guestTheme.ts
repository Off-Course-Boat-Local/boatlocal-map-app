// Shared visual constants for the guest-facing screens.
//
// These mirror the reference design system (the `nice-notice` prototype's
// src/styles.css) with one critical difference: the reference is a
// single-tenant demo with a fixed blue, while this app is white-labeled —
// every company has its own brand colour, delivered ONLY through the
// CSS custom properties src/lib/brand.ts writes (--brand-primary,
// --brand-primary-dark, --brand-accent, --brand-surround).
//
// Token mapping, reference → here:
//   --brand        → var(--brand-primary)
//   --brand-deep   → var(--brand-primary-dark)   (used in BRAND_GRADIENT)
//   --brand-soft   → BRAND_SOFT  (color-mix 15% primary on white — active
//                    tab pill, step-number circles, icon chips)
//   --brand-tint   → BRAND_TINT  (color-mix 12% primary on white — emphasis
//                    card backgrounds; same expression GuestReviewScreen
//                    already shipped as EMPHASIS_TINT, kept byte-identical)
//   --brand-foreground → #FFFFFF
//   neutrals (ink / muted / border / secondary / surface) → literal hexes,
//     defined once here; they never re-skin per tenant.
//   --shadow-card / --shadow-float → SHADOW_CARD / SHADOW_FLOAT.
//
// `globals.css` is not ours to edit (see src/lib/fonts.ts), so these are
// plain string constants for inline styles / arbitrary Tailwind values —
// never new @theme tokens.

/** Near-black text colour ("ink" in the reference). */
export const INK = "#0B1421";

/** Muted/secondary text. */
export const MUTED = "#657386";

/** Hairline borders. */
export const BORDER = "#E1E7EE";

/** Secondary fills — segmented-control track, icon swatches. */
export const SECONDARY = "#EFF5FC";

/** App surface behind cards/sheets. */
export const SURFACE = "#F7FAFE";

/** Active-tab pill / soft brand chips — reference `--brand-soft`. */
export const BRAND_SOFT = "color-mix(in srgb, var(--brand-primary) 15%, white)";

/**
 * Emphasis-card background — reference `--brand-tint`. Identical to the
 * EMPHASIS_TINT GuestReviewScreen established; keep the two in lockstep.
 */
export const BRAND_TINT = "color-mix(in srgb, var(--brand-primary) 12%, white)";

/** Header band gradient — reference `from-brand to-brand-deep`. */
export const BRAND_GRADIENT =
  "linear-gradient(to bottom, var(--brand-primary), var(--brand-primary-dark))";

/** Card shadow — reference `--shadow-card`. */
export const SHADOW_CARD =
  "0 1px 2px oklch(0.19 0.03 258 / 6%), 0 12px 28px -18px oklch(0.19 0.03 258 / 22%)";

/** Floating (bottom-anchored) shadow — reference `--shadow-float`. */
export const SHADOW_FLOAT =
  "0 -1px 0 oklch(0.19 0.03 258 / 5%), 0 -14px 34px -22px oklch(0.19 0.03 258 / 30%)";
