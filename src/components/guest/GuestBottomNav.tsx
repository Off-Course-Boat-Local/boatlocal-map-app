"use client";

// The bottom tab bar shown on every guest page: Map · List · Saved · Review ·
// Install. Visuals are a direct port of the reference design's TabBar
// (nice-notice's src/components/mobile-shell.tsx): a 5-column grid of Lucide
// icons, each sitting in an h-8/w-12 pill that fills with a soft brand tint
// when active, over an 11px medium-weight Figtree label. The bar itself is
// translucent white with a backdrop blur and a hairline top border. The one
// active tab takes --brand-primary (never a literal hex; see
// src/lib/brand.ts / src/lib/guestTheme.ts).
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
  Download,
  Heart,
  LayoutList,
  Map as MapIcon,
  MessageSquareHeart,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { bodyFontFamily } from "@/lib/fonts";
import { withGuestQuery } from "@/lib/guestLinks";
import { BORDER, BRAND_SOFT, MUTED } from "@/lib/guestTheme";

const ICON_CLASS = "h-[1.15rem] w-[1.15rem]";
const ICON_STROKE = 2;

interface NavItem {
  href: string;
  label: string;
  icon: (props: { active: boolean }) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/map",
    label: "Map",
    icon: () => <MapIcon className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
  {
    href: "/list",
    label: "List",
    icon: () => <LayoutList className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
  {
    href: "/saved",
    label: "Saved",
    // Fills with the brand colour when active — the same one consistent
    // "saved" mark as SaveHeartButton and PlaceCard's heart.
    icon: ({ active }) => (
      <Heart
        className={ICON_CLASS}
        strokeWidth={ICON_STROKE}
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
    ),
  },
  {
    href: "/review",
    label: "Review",
    icon: () => (
      <MessageSquareHeart className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />
    ),
  },
  {
    href: "/install",
    label: "Install",
    icon: () => <Download className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
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
      className="grid shrink-0 grid-cols-5 backdrop-blur"
      style={{
        background: "rgba(255,255,255,0.95)",
        borderTop: `1px solid ${BORDER}`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const color = active ? "var(--brand-primary)" : MUTED;
        const target = withGuestQuery(href, qs);
        const badgeCount = href === "/saved" ? savedCount : 0;
        return (
          <Link
            key={href}
            href={target}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition-colors"
            style={{ color, WebkitTapHighlightColor: "transparent" }}
          >
            <span
              className="relative grid h-8 w-12 place-items-center rounded-full transition-colors"
              style={{ background: active ? BRAND_SOFT : "transparent" }}
            >
              <Icon active={active} />
              {badgeCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-semibold"
                  style={{
                    background: "var(--brand-primary)",
                    color: "#FFFFFF",
                    fontFamily: bodyFontFamily,
                  }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </span>
            <span
              className="text-[0.6875rem] font-medium"
              style={{ fontFamily: bodyFontFamily, lineHeight: 1 }}
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
