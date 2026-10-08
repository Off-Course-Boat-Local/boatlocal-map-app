"use client";

// The bottom tab bar shown on every guest page: Home · Map · List · Saved ·
// Install (Review lives on Home as a welcome block). Visuals are a direct port of the reference design's TabBar
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
  House,
  LayoutList,
  Map as MapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { bodyFontFamily } from "@/lib/fonts";
import { withGuestQuery } from "@/lib/guestLinks";
import { BORDER, BRAND_SOFT, MUTED } from "@/lib/guestTheme";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const ICON_CLASS = "h-[1.15rem] w-[1.15rem]";
const ICON_STROKE = 2;

interface NavItem {
  href: string;
  /** Dictionary key under `nav` — the LABEL is looked up per locale at render. */
  labelKey: "home" | "map" | "list" | "saved" | "install";
  icon: (props: { active: boolean }) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    labelKey: "home",
    icon: () => <House className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
  {
    href: "/map",
    labelKey: "map",
    icon: () => <MapIcon className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
  {
    href: "/list",
    labelKey: "list",
    icon: () => <LayoutList className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
  {
    href: "/saved",
    labelKey: "saved",
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
    href: "/install",
    labelKey: "install",
    icon: () => <Download className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />,
  },
];

export default function GuestBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const { count: savedCount } = useSavedPlaces();
  const { t } = useI18n();

  const [isExpanded, setIsExpanded] = useState(true);

  // Always reset to expanded when navigating between pages
  useEffect(() => {
    setIsExpanded(true);
  }, [pathname]);

  // Listen for scroll events across any scrolling child container
  useEffect(() => {
    let lastTarget: EventTarget | null = null;
    let lastScrollTop = 0;
    let accumulatedDelta = 0;

    const handleScroll = (event: Event) => {
      const target = event.target;
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      if (target === document || target === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      } else if (target instanceof HTMLElement) {
        scrollHeight = target.scrollHeight;
        clientHeight = target.clientHeight;
        // Ignore horizontal-only or non-scrollable containers
        if (scrollHeight - clientHeight < 15) return;
        scrollTop = target.scrollTop;
      } else {
        return;
      }

      if (target !== lastTarget) {
        lastTarget = target;
        lastScrollTop = scrollTop;
        accumulatedDelta = 0;
      }

      // At or near top of the page / container: always expand
      if (scrollTop <= 20) {
        setIsExpanded(true);
        accumulatedDelta = 0;
        lastScrollTop = scrollTop;
        return;
      }

      // Ignore iOS bottom bounce
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll > 0 && scrollTop >= maxScroll - 5) {
        lastScrollTop = scrollTop;
        return;
      }

      const delta = scrollTop - lastScrollTop;
      lastScrollTop = scrollTop;

      if (delta > 0) {
        // Scrolling down -> collapse into compact mode after 25px scroll
        if (accumulatedDelta < 0) accumulatedDelta = 0;
        accumulatedDelta += delta;
        if (accumulatedDelta > 25 && scrollTop > 30) {
          setIsExpanded(false);
        }
      } else if (delta < 0) {
        // Scrolling up -> expand back to full mode after 15px scroll
        if (accumulatedDelta > 0) accumulatedDelta = 0;
        accumulatedDelta += delta;
        if (accumulatedDelta < -15) {
          setIsExpanded(true);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    // Swipe / touch drag listener (e.g. panning on the map or swipe gestures)
    let touchStartY = 0;
    let touchStartX = 0;
    let isTouchSwiping = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        isTouchSwiping = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchSwiping || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = currentY - touchStartY;
      const diffX = currentX - touchStartX;
      const dist = Math.hypot(diffX, diffY);

      // If user moved finger more than 20px, minimize the menu
      if (dist > 20) {
        setIsExpanded(false);
      }
    };

    const handleTouchEnd = () => {
      isTouchSwiping = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleNavClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleItemClick = (isActive: boolean) => {
    if (!isExpanded) {
      setIsExpanded(true);
    } else if (isActive) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label={t.nav.ariaLabel}
        onClick={handleNavClick}
        data-expanded={isExpanded}
        className={`pointer-events-auto flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/95 backdrop-blur-md transition-all duration-300 ease-out cursor-pointer ${
          isExpanded
            ? "w-full max-w-[355px] px-2 py-1.5"
            : "w-full max-w-[290px] px-2 py-1"
        }`}
        style={{
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
        }}
      >
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const label = t.nav[labelKey];
          const active = pathname === href;
          const color = active ? "var(--brand-primary)" : MUTED;
          const target = withGuestQuery(href, qs);
          const badgeCount = href === "/saved" ? savedCount : 0;
          return (
            <Link
              key={href}
              href={target}
              aria-current={active ? "page" : undefined}
              onClick={() => handleItemClick(active)}
              className={`flex flex-col items-center justify-center outline-none focus:outline-none transition-all duration-300 ease-in-out flex-1 ${
                isExpanded ? "gap-0.5" : "gap-0"
              }`}
              style={{ color, WebkitTapHighlightColor: "transparent" }}
            >
              <span
                className={`relative grid place-items-center rounded-xl transition-all duration-300 ease-in-out ${
                  isExpanded ? "h-8 w-11" : "h-7.5 w-10"
                }`}
                style={{ background: active ? BRAND_SOFT : "transparent" }}
              >
                <Icon active={active} />
                {badgeCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-semibold"
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
                className={`overflow-hidden text-[0.625rem] font-medium transition-all duration-300 ease-in-out ${
                  isExpanded
                    ? "max-h-4 opacity-100 translate-y-0"
                    : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                }`}
                style={{ fontFamily: bodyFontFamily, lineHeight: 1 }}
              >
                {label}
                {badgeCount > 0 ? (
                  <span className="sr-only">{t.nav.savedBadge(badgeCount)}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
