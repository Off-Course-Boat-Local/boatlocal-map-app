// White-label brand tokens.
//
// This is the layer that makes the app re-skinnable. Every component reads
// colour from CSS custom properties set by applyBrand() — no hard-coded
// brand colour anywhere else in the codebase. Swapping brands must never
// require touching a component.
//
// The five brands below are the ones shown in prototype 2's "One app,
// every brand" section.

import type { Brand } from "./types";

export const BRANDS: Record<string, Brand> = {
  coastal: {
    id: "coastal",
    companyName: "Boat Local",
    appName: "BoatLocal Map App",
    primary: "#2B4FE0",
    primaryDark: "#1D37A8",
    accent: "#6E8CFF",
    surround: "#E8E6DF",
    logoUrl: null,
  },
  coral: {
    id: "coral",
    companyName: "Hotel V Nesplein",
    appName: "Hotel V's Amsterdam",
    primary: "#C93B2C",
    primaryDark: "#96271A",
    accent: "#FF8A7A",
    surround: "#F2E9E4",
    logoUrl: null,
  },
  forest: {
    id: "forest",
    companyName: "Jordaan B&B",
    appName: "Our Jordaan",
    primary: "#2E7D52",
    primaryDark: "#1E5636",
    accent: "#6FBF8F",
    surround: "#E7EBE4",
    logoUrl: null,
  },
  tulip: {
    id: "tulip",
    companyName: "Canal Tours XL",
    appName: "Canal Tours XL Guide",
    primary: "#B32A6E",
    primaryDark: "#7E1B4B",
    accent: "#FF7ABF",
    surround: "#F3E7EE",
    logoUrl: null,
  },
  ink: {
    id: "ink",
    companyName: "Off Course Amsterdam",
    appName: "Off Course",
    primary: "#1F2430",
    primaryDark: "#0D1017",
    accent: "#5C6B85",
    surround: "#E6E6E2",
    logoUrl: null,
  },
};

export const DEFAULT_BRAND = BRANDS.coastal;

/**
 * Writes a brand to CSS custom properties on the given element (default
 * :root). In the real app this is resolved from the `?company=` query param
 * in Proxy (src/proxy.ts) and injected server-side so there is no flash of
 * unbranded content.
 */
export function brandCssVars(brand: Brand): Record<string, string> {
  return {
    "--brand-primary": brand.primary,
    "--brand-primary-dark": brand.primaryDark,
    "--brand-accent": brand.accent,
    "--brand-surround": brand.surround,
  };
}
