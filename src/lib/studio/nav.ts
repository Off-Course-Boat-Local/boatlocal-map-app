// Studio sidebar navigation — one config, two role-filtered lists.
//
// Studio is ONE back office for both "company" and "guide" roles (not two
// separate apps), so the gating happens here, at the nav-item level, plus
// again at the top of each gated page (requireCompanyRole/requireGuideRole
// in src/lib/studio/devAuth.ts) — a guide who guesses /studio/branding gets
// redirected, not just hidden from a link.
//
// Per the product decision: a "guide" sees Dashboard, Recommendations (their
// own — the base list is read-only), and their own Link & QR / Stats. A
// "company" sees everything, including inviting guides and featuring boat
// tours.

import type { StudioRole } from "./devAuth";

export interface StudioNavItem {
  key: string;
  label: string;
  href: string;
}

export const COMPANY_NAV: StudioNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/studio" },
  { key: "branding", label: "Branding", href: "/studio/branding" },
  { key: "guides", label: "Guides", href: "/studio/guides" },
  { key: "recommendations", label: "Recommendations", href: "/studio/recommendations" },
  { key: "boat-tours", label: "Boat tours", href: "/studio/boat-tours" },
  { key: "campaign", label: "Campaign", href: "/studio/campaign" },
  { key: "report", label: "Report", href: "/studio/report" },
];

export const GUIDE_NAV: StudioNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/studio" },
  { key: "recommendations", label: "Recommendations", href: "/studio/recommendations" },
  { key: "link-qr", label: "Link & QR / Stats", href: "/studio/link-qr" },
];

export function navForRole(role: StudioRole): StudioNavItem[] {
  return role === "company" ? COMPANY_NAV : GUIDE_NAV;
}
