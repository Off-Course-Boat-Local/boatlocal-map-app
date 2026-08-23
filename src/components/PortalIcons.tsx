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

/**
 * A guide's own Profile tab. A single figure, deliberately distinct from
 * UsersIcon's pair — that one means "the guides working for this company"
 * (a company-role management tab), this one means "me".
 */
export function PersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6" />
    </svg>
  );
}

/** Guest-app preview — a phone. Sits with Log out at the foot of the
 *  Studio sidebar rather than in the nav list above it, because previewing
 *  is a way of *looking at* the tenant's guest app, not another page of
 *  Studio to manage. */
export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.75 5.5h2.5" />
    </svg>
  );
}

/** Sign out — sits beside PhoneIcon at the foot of the Studio sidebar, so it
 *  carries an icon too rather than being the one unaligned row down there. */
export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 8.5V5.75a1.5 1.5 0 0 0-1.5-1.5H6.25a1.5 1.5 0 0 0-1.5 1.5v12.5a1.5 1.5 0 0 0 1.5 1.5H13a1.5 1.5 0 0 0 1.5-1.5V15.5" />
      <path d="M10.5 12h9M16.75 8.75 19.75 12l-3 3.25" />
    </svg>
  );
}

/** Account settings. */
export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" />
    </svg>
  );
}

/** Row/kebab action-menu trigger — three vertical dots. */
export function MoreIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** "View details" row action. */
export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

/** Archive / suspend row action — a lidded box. */
export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M4.75 8.5v9a1.5 1.5 0 0 0 1.5 1.5h11.5a1.5 1.5 0 0 0 1.5-1.5v-9" />
      <path d="M10 12.5h4" />
    </svg>
  );
}

/** Go-live / reactivate row action. */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.25 2.4 2.4 4.6-5.3" />
    </svg>
  );
}

/** Permanent delete row action. */
export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6.5" />
      <path d="M6.75 6.5 7.5 19a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.75-12.5" />
      <path d="M10.25 10.5v6M13.75 10.5v6" />
    </svg>
  );
}

/** "Copy invite link" row action — two overlapping squares. */
export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.5" y="8.5" width="11" height="12.5" rx="1.5" />
      <path d="M15.5 8.5V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V16a1.5 1.5 0 0 0 1.5 1.5h2.5" />
    </svg>
  );
}

/** "Re-send" invite row action — a paper plane. */
export function SendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 3 3 10.5l7 2.5 2.5 7Z" />
      <path d="M21 3 12.5 13" />
    </svg>
  );
}

/** "New link" (regenerate invite) row action — a refresh loop. */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 8.5" />
      <path d="M19.5 4.5v4h-4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15.5" />
      <path d="M4.5 19.5v-4h4" />
    </svg>
  );
}

/** "Set/unset as default" row action, and the Admin sidebar's "Default company" nav item — a five-point star, same stroke weight as every other icon here. */
export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 14.5 9.6 21 10.1 16 14.2 17.6 20.5 12 17 6.4 20.5 8 14.2 3 10.1 9.5 9.6Z" strokeLinejoin="round" />
    </svg>
  );
}
