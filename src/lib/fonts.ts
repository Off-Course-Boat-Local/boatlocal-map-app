// Typography for the map spike.
//
// Two faces only:
//   - a high-contrast serif display face for place names / headings
//   - a neutral geometric sans for everything else
//
// Both are loaded via next/font/google (self-hosted at build time, no runtime
// request to Google) and exposed as CSS custom properties so components never
// import a font object directly.
//
// WIRING: `src/app/layout.tsx` is not owned by this module. To make the
// variables available app-wide, add `fontVariables` to the <html> className:
//
//   import { fontVariables } from "@/lib/fonts";
//   <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}>
//
// Until that lands, any subtree can opt in by putting `fontVariables` on its
// own wrapper element — which is exactly what /spike/components does, so the
// demo page is self-sufficient.

import { Inter, Playfair_Display } from "next/font/google";

/** High-contrast serif — place names, section headings. */
export const displaySerif = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  // Variable font: 400–900 available, we use 500–700.
});

/** Neutral sans — everything that is not a name or a heading. */
export const bodySans = Inter({
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
  'var(--font-body), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
