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
        {/* Exact glyph lifted from the original prototype's own logo badge
            (boatlocalprototype.netlify.app, sampled via devtools) — a
            sailboat: hull/wake ellipse, two sail curves off a masthead
            ball, and the mast itself. Traced 1:1 (same path/ellipse
            coordinates on the same 32x32 viewBox), just white-on-gradient
            here instead of on the prototype's own gradient badge. */}
        <svg
          width={iconSize * 0.6}
          height={iconSize * 0.6}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <ellipse cx="16" cy="21" rx="12" ry="4.5" stroke="white" strokeWidth="2.2" />
          <path d="M16 5 C16 5 9 13 9 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 5 C16 5 23 13 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="16" cy="5" r="2.6" fill="white" />
          <line x1="16" y1="7.6" x2="16" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-bold tracking-tight">
        Map<span className="font-medium opacity-60">App</span>
      </span>
    </span>
  );
}
