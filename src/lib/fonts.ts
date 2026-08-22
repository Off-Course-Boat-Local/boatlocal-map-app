// Typography for the guest app.
//
// Two faces only:
//   - a high-contrast serif display face — for LARGE headings only
//   - the product's own sans (Hanken Grotesk, same face as Studio/Admin and
//     the original prototype) for everything else
//
// THE SIZE RULE (from the founder-requested UI audit): the serif is a
// display face — it only earns its keep at roughly 22px and up. Below that
// its thin strokes and uneven rhythm read as "gappy" and cramped (the exact
// complaint that triggered the audit: 16px-bold serif row titles, 11px serif
// tab labels). So: screen titles, the welcome headline, and the place-detail
// name may use displayFontFamily; row titles, buttons, labels, meta lines,
// and nav labels use bodyFontFamily. When in doubt, sans.
//
// Both faces are loaded via next/font/google (self-hosted at build time, no
// runtime request to Google) and exposed as CSS custom properties so
// components never import a font object directly.
//
// WIRING: `src/app/layout.tsx` puts `fontVariables` on <html>, making both
// variables available app-wide. Any isolated subtree (e.g.
// /spike/components) can also opt in by putting `fontVariables` on its own
// wrapper element.

import { Hanken_Grotesk, Playfair_Display } from "next/font/google";

/** High-contrast serif — large headings and place-detail names ONLY (see the size rule above). */
export const displaySerif = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  // Variable font: 400–900 available, we use 500–700.
});

/**
 * The product sans — Hanken Grotesk, the same face Studio/Admin and the
 * original prototype use, replacing the Inter this module started with so
 * the guest app and the portal finally share one voice.
 */
export const bodySans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

/** Put this on <html> (or any wrapper) to publish both CSS variables. */
export const fontVariables = `${displaySerif.variable} ${bodySans.variable}`;

/**
 * Font stacks for inline `style` use.
 *
 * `globals.css` is not ours to edit, so we can't register these as Tailwind
 * `@theme` tokens (`font-display` / `font-body` utilities). Components
 * therefore reference the CSS variables directly, with a system fallback
 * chain so the UI never renders in Times if the variable is missing.
 */
export const displayFontFamily =
  'var(--font-display), "Playfair Display", Georgia, "Times New Roman", serif';

export const bodyFontFamily =
  'var(--font-body), "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
