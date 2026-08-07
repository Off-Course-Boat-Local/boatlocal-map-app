// Shared line-icon set for the Admin and Studio sidebars — the two
// staff-facing "portal" surfaces that share one design system (see
// MapAppMark.tsx's header comment). Deliberately plain, minimal stroke
// icons (24x24, currentColor) rather than a full icon library dependency:
// there are only a handful of nav items across both sidebars, and matching
// exact glyphs to a design library isn't worth the bundle/dependency for
// that count.
//
// GridIcon, PaletteIcon, and PinListIcon are traced 1:1 (same path/shape
// coordinates, just recoloured to currentColor) from the original
// prototype's own Dashboard/Branding/Listings nav icons
// (boatlocalprototype.netlify.app "Partner Studio" section, sampled via
// devtools) — not independently designed. The prototype has no Companies/
// Guides/Platform-analytics/Campaign/Report/Link-QR equivalent (Admin and
// the guide-only nav have more pages than the prototype's 4-item demo
// sidebar), so BuildingIcon/UsersIcon/ChartIcon/LinkIcon/MegaphoneIcon/
// ReportIcon are original, matched to the same stroke weight/style instead.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <rect x="3" y="3" width="7" height="9" rx="1.4" />
      <rect x="14" y="3" width="7" height="5" rx="1.4" />
      <rect x="14" y="11" width="7" height="10" rx="1.4" />
      <rect x="3" y="15" width="7" height="6" rx="1.4" />
    </svg>
  );
}

/** The prototype's own "Boat tours" glyph — a pennant flag on a mast, not
 *  an anchor — kept as `AnchorIcon` for the existing call-site name Admin's
 *  "Boats" nav item already used. */
export function AnchorIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 15h16l-2.2 4.2H6.2z" fill="currentColor" stroke="none" />
      <path d="M11.2 3l5.6 10H11.2z" fill="currentColor" stroke="none" />
      <rect x="10.3" y="3" width="1.3" height="10" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3.5" width="10" height="17" rx="1" />
      <path d="M15 9.5h4v11h-9" />
      <path d="M8 7.5h1M11 7.5h1M8 11h1M11 11h1M8 14.5h1M11 14.5h1" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.25" />
      <path d="M15.8 14.2c2.3.3 4.2 2.1 4.2 4.8" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PinListIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 7l1.4-1.4a3.5 3.5 0 0 1 5 5L16 12" />
      <path d="M13 17l-1.4 1.4a3.5 3.5 0 0 1-5-5L8 12" />
    </svg>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5h1l.8 4h2l-.6-4H10l8 3.5v-12L10 10H6.5A1.5 1.5 0 0 0 4 10.5Z" />
      <path d="M18 8.5v7" />
    </svg>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  );
}
