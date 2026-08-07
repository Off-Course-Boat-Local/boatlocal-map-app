// Shared "Map App" wordmark — the product's own identity, used on every
// staff-facing surface (Admin, Studio) that isn't a guest-facing, tenant-
// branded screen. This is the one shared design system between Admin and
// Studio (per the founder: "the partner studio is meant to be the
// portal... same design" for admins and companies/guides alike, just
// different pages) — see PORTAL_ACCENT below, which both sidebars' active
// nav-item state also reads from.
//
// Colours are lifted directly from the original prototype
// (boatlocalprototype.netlify.app, "Partner Studio" section) via its
// computed styles: a blue -> orange diagonal gradient badge, 150deg,
// #1B5FE3 -> #FF7A45. No image asset exists yet — this is a plain inline
// SVG badge + text lockup, easy to swap for a real logo file later without
// touching any call site's layout.

/** The portal's one shared accent colour — also used for primary buttons
 *  and the active nav-item pill in both AdminSidebar and StudioSidebar. */
export const PORTAL_ACCENT = "#1B5FE3";
export const PORTAL_ACCENT_GRADIENT = "linear-gradient(150deg, #1B5FE3, #FF7A45)";
/** The active-nav-item pill background (sampled from the prototype). */
export const PORTAL_NAV_ACTIVE_BG = "#E8EFFC";

export interface MapAppMarkProps {
  className?: string;
  /** Badge size in pixels. Text scales independently via className. */
  iconSize?: number;
}

export default function MapAppMark({ className, iconSize = 26 }: MapAppMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <span
        className="flex shrink-0 items-center justify-center rounded-[9px]"
        style={{
          width: iconSize,
          height: iconSize,
          background: PORTAL_ACCENT_GRADIENT,
        }}
      >
        <svg
          width={iconSize * 0.56}
          height={iconSize * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2.5c-3.59 0-6.5 2.84-6.5 6.35 0 4.77 5.6 11.42 5.84 11.7a.87.87 0 0 0 1.32 0c.24-.28 5.84-6.93 5.84-11.7 0-3.51-2.91-6.35-6.5-6.35Z"
            fill="white"
            fillOpacity="0.92"
          />
          <circle cx="12" cy="8.85" r="2.15" fill={PORTAL_ACCENT} />
        </svg>
      </span>
      <span className="font-bold tracking-tight">
        Map<span className="font-medium opacity-60">App</span>
      </span>
    </span>
  );
}
