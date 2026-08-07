// Shared line-icon set for the Admin and Studio sidebars — the two
// staff-facing "portal" surfaces that share one design system (see
// MapAppMark.tsx's header comment). Deliberately plain, minimal stroke
// icons (24x24, currentColor) rather than a full icon library dependency:
// there are only a handful of nav items across both sidebars, and matching
// exact glyphs to a design library isn't worth the bundle/dependency for
// that count.

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
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function AnchorIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M12 7.5V19" />
      <path d="M6 13a6 6 0 0 0 12 0" />
      <path d="M3.5 13H6" />
      <path d="M18 13h2.5" />
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
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.8 1.2-1.7-.3-.7.2-1.5 1-1.5h1.6a3 3 0 0 0 3-3c0-6-3-10.8-6.8-10.8Z" />
      <circle cx="8" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PinListIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5c-2 0-3.5 1.5-3.5 3.5 0 2.5 3.5 6 3.5 6s3.5-3.5 3.5-6c0-2-1.5-3.5-3.5-3.5Z" />
      <circle cx="8" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <path d="M13 8h7M13 13h7M13 18h7" />
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
