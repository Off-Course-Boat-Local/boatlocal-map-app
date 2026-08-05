"use client";

// The bottom tab bar shown on every guest page: Map · List · Saved · Review ·
// Install. Same design language as the rest of the guest app — the serif
// display face on labels, neutral chrome everywhere except the one active
// tab, which takes --brand-primary (never a literal hex; see src/lib/brand.ts).
//
// Query params (today's `?company=`/`?guide=` brand-resolution stand-in —
// see src/lib/guestBrand.ts) are carried across tabs so switching screens
// never drops the tenant you were previewing.
//
// The Saved tab also carries a live count badge, sourced from the same
// useSavedPlaces() hook the Saved screen itself uses (src/hooks/useSavedPlaces.ts,
// backed by src/lib/savedPlaces.ts's localStorage helpers) — one source of
// truth, so the badge can never drift from what Saved actually shows.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { displayFontFamily } from "@/lib/fonts";
import { withGuestQuery } from "@/lib/guestLinks";

const INACTIVE = "#8A8D95";

function MapGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4 3 6.2v13.8L9 18l6 2 6-2.2V4L15 6l-6-2Zm0 2.1 6 2v9.8l-6-2V6.1Z"
        fill={color}
      />
    </svg>
  );
}

function ListGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 6h13v2H8V6Zm0 5h13v2H8v-2Zm0 5h13v2H8v-2ZM3.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
        fill={color}
      />
    </svg>
  );
}

/** Same silhouette as the PlaceCard save heart, for one consistent "saved" mark. */
function SavedGlyph({ color, active }: { color: string; active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4 4.6 13a4.8 4.8 0 0 1 6.8-6.8l.6.6.6-.6A4.8 4.8 0 0 1 19.4 13L12 20.4Z"
        fill={active ? color : "none"}
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReviewGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.4 3.3A.6.6 0 0 1 3.6 20V7a1 1 0 0 1 1-1Z"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="10.7" r="1.1" fill={color} />
      <circle cx="12" cy="10.7" r="1.1" fill={color} />
      <circle cx="15.5" cy="10.7" r="1.1" fill={color} />
    </svg>
  );
}

function InstallGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v10.6M8 10.6 12 14.6 16 10.6"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: (props: { color: string; active: boolean }) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/map", label: "Map", icon: ({ color }) => <MapGlyph color={color} /> },
  { href: "/list", label: "List", icon: ({ color }) => <ListGlyph color={color} /> },
  {
    href: "/saved",
    label: "Saved",
    icon: ({ color, active }) => <SavedGlyph color={color} active={active} />,
  },
  { href: "/review", label: "Review", icon: ({ color }) => <ReviewGlyph color={color} /> },
  { href: "/install", label: "Install", icon: ({ color }) => <InstallGlyph color={color} /> },
];

export default function GuestBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const { count: savedCount } = useSavedPlaces();

  return (
    <nav
      aria-label="Guest navigation"
      className="flex shrink-0 border-t border-neutral-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const color = active ? "var(--brand-primary)" : INACTIVE;
        const target = withGuestQuery(href, qs);
        const badgeCount = href === "/saved" ? savedCount : 0;
        return (
          <Link
            key={href}
            href={target}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
            style={{ color, WebkitTapHighlightColor: "transparent", position: "relative" }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon color={color} active={active} />
              {badgeCount > 0 ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    minWidth: 15,
                    height: 15,
                    padding: "0 3px",
                    borderRadius: 9999,
                    background: "var(--brand-primary)",
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: "15px",
                    textAlign: "center",
                  }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </span>
            <span style={{ fontFamily: displayFontFamily, fontSize: 11, lineHeight: 1 }}>
              {label}
              {badgeCount > 0 ? (
                <span className="sr-only">{` (${badgeCount} saved)`}</span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
