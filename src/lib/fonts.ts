// Typography for the guest app.
//
// Two faces, straight from the reference design system:
//   - Outfit — the display face, a geometric sans. Headings (h1–h4
//     equivalents), card/row titles, prices, and section headers. Large
//     headings take letter-spacing: -0.02em (the header band title, the
//     place-detail name). Because it's a sans, the old "serif only above
//     ~22px" size rule from the founder UI audit is obsolete: Outfit stays
//     crisp at card-title sizes too.
//   - Figtree — the body face. Body copy, labels, buttons, chips, and
//     metadata lines.
//
// Both faces are loaded via next/font/google (self-hosted at build time, no
// runtime request to Google) and exposed as CSS custom properties so
// components never import a font object directly.
//
// WIRING: `src/app/layout.tsx` puts `fontVariables` on <html>, making both
// variables available app-wide. Any isolated subtree (e.g.
// /spike/components) can also opt in by putting `fontVariables` on its own
// wrapper element.

import { Figtree, Outfit } from "next/font/google";

/** Display face — headings, card titles, prices, section headers. */
export const displaySans = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  // Variable font: 100–900 available, we use 400/500/600/700.
});

/** Body face — copy, labels, buttons, chips, metadata. */
export const bodySans = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  // Variable font: 300–900 available, we use 400/500/600.
});

/** Put this on <html> (or any wrapper) to publish both CSS variables. */
export const fontVariables = `${displaySans.variable} ${bodySans.variable}`;

/**
 * Font stacks for inline `style` use.
 *
 * `globals.css` is not ours to edit, so we can't register these as Tailwind
 * `@theme` tokens (`font-display` / `font-body` utilities). Components
 * therefore reference the CSS variables directly, with a system fallback
 * chain so the UI never falls apart if the variable is missing.
 */
export const displayFontFamily =
  'var(--font-display), "Outfit", ui-sans-serif, system-ui, sans-serif';

export const bodyFontFamily =
  'var(--font-body), "Figtree", ui-sans-serif, system-ui, sans-serif';
