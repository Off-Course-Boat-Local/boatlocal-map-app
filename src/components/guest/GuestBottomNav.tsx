"use client";

// The bottom tab bar shown on every guest page: Map · List · Saved · Review ·
// Install. Icons are Lucide (the same stroke language as the portal
// sidebars) — they replaced a set of hand-drawn glyphs after the founder's
// UI audit called those out as visibly homemade. Labels are the SANS face,
// deliberately: they used to be 11px serif, and a high-contrast display
// serif at 11px is exactly the kind of muddy micro-typography the audit
// flagged (see src/lib/fonts.ts's size rule). Neutral chrome everywhere
// except the one active tab, which takes --brand-primary (never a literal
// hex; see src/lib/brand.ts).
//
// Query params (today's `?company=`/`?guide=` brand-resolution stand-in —
// see src/lib/guestBrand.ts) are carried across tabs so switching screens
// never drops the tenant you were previewing.
//
// The Saved tab also carries a live count badge, sourced from the same
// useSavedPlaces() hook the Saved screen itself uses (src/hooks/useSavedPlaces.ts,
// backed by src/lib/savedPlaces.ts's localStorage helpers) — one source of
// truth, so the badge can never drift from what Saved actually shows.

import {
  ArrowDownToLine,
  Heart,
  List,
  Map as MapIcon,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { bodyFontFamily } from "@/lib/fonts";
import { withGuestQuery } from "@/lib/guestLinks";

const INACTIVE = "#8A8D95";
const ICON_SIZE = 22;
const ICON_STROKE = 1.9;

interface NavItem {
  href: string;
  label: string;
  icon: (props: { color: string; active: boolean }) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/map",
    label: "Map",
    icon: ({ color }) => <MapIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} aria-hidden />,
  },
  {
    href: "/list",
    label: "List",
    icon: ({ color }) => <List size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} aria-hidden />,
  },
  {
    href: "/saved",
    label: "Saved",
    // Fills with the brand colour when active — the same one consistent
    // "saved" mark as SaveHeartButton and PlaceCard's heart.
    icon: ({ color, active }) => (
      <Heart
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        color={color}
        fill={active ? color : "none"}
        aria-hidden
      />
    ),
  },
  {
    href: "/review",
    label: "Review",
    icon: ({ color }) => (
      <MessageSquareText size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} aria-hidden />
    ),
  },
  {
    href: "/install",
    label: "Install",
    icon: ({ color }) => (
      <ArrowDownToLine size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} aria-hidden />
    ),
  },
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
            className="flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5"
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
            <span
              style={{
                fontFamily: bodyFontFamily,
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
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
