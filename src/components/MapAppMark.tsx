// Shared "Map App" wordmark — the product's own identity, used on every
// staff-facing surface (Admin, Studio) that isn't a guest-facing, tenant-
// branded screen.
//
// Badge uses the solid black background (#17181C) with white sailboat glyph.

export const PORTAL_ACCENT = "#1B5FE3";
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
          background: "#17181C",
        }}
      >
        <svg
          width={iconSize * 0.6}
          height={iconSize * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3v8H6l6-8zm1 0v8h5l-5-8zM3.5 14h17l-2.2 4.2a3 3 0 0 1-2.7 1.6H8.4a3 3 0 0 1-2.7-1.6L3.5 14z"
            fill="#FFFFFF"
          />
        </svg>
      </span>
      <span className="font-bold tracking-tight">
        Map<span className="font-medium opacity-60">App</span>
      </span>
    </span>
  );
}
