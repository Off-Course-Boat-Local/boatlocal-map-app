"use client";

// The guest Welcome screen — PRD §5.1.
//
// This is the first thing a guest sees at the tenant root (before they ever
// tap into Map or List): guide avatar + name + a personal welcome quote, a
// PWA "add to home screen" nudge, the two primary CTAs, a pinned top pick
// (defaults to the featured boat tour, per PRD), and a collapsible "share
// with a travel companion" section built on the existing ShareQr component.
//
// Reused, not rebuilt: PlaceCard (+ its PhotoGallery) for the top-pick card,
// ShareQr for the QR, and the same grid-template-rows collapse technique
// PlaceCard's own photo gallery uses for the share section — one consistent
// "how things expand" idiom across the app.
//
// DELIBERATE OMISSION: no star rating, no review count, anywhere on this
// screen. The guide's quote and their top pick's note are the endorsement.

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { PlaceCard } from "@/components/map/PlaceCard";
import ShareQr from "@/components/ShareQr";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import type { MapPin } from "@/lib/data";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { guestPinActionUrl } from "@/lib/guestActions";
import { withGuestQuery } from "@/lib/guestLinks";
import type { Brand } from "@/lib/types";

/* Neutral chrome — never re-skins. Matches PlaceCard's palette. */
const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

/** localStorage key for "don't show the install nudge again". Guest-only, not sensitive. */
const INSTALL_BANNER_DISMISSED_KEY = "bl_guest_install_banner_dismissed";

export interface GuestWelcomeScreenProps {
  brand: Brand;
  guideName: string;
  guideAvatarInitial: string;
  guideWelcome: string;
  /** Non-boat recommendation count, for the CTA subtitle. */
  placeCount: number;
  /** Defaults to the first featured boat tour (see the Welcome page's fetch). Null when the tenant has none. */
  topPick: MapPin | null;
  /** Preserved `?company=`/`?guide=` query string — see src/lib/guestLinks.ts. */
  qs: string;
}

function GuideAvatar({ initial }: { initial: string }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white"
      style={{
        fontFamily: displayFontFamily,
        fontSize: 26,
        fontWeight: 700,
        color: "var(--brand-primary)",
        boxShadow: "0 6px 16px -6px rgba(0,0,0,0.35)",
      }}
    >
      {initial}
    </div>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 200ms ease",
        flexShrink: 0,
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke={MUTED}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstallGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v10.6M8 10.6 12 14.6 16 10.6"
        fill="none"
        stroke="var(--brand-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5"
        fill="none"
        stroke="var(--brand-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Never actually notifies — see the read below for why that's fine. */
const subscribeNever = () => () => {};

function readInstallBannerDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === "1";
  } catch {
    // Storage disabled (private browsing, locked-down browser) — treat as
    // "not dismissed" so the nudge still shows rather than getting lost.
    return false;
  }
}

/**
 * PWA install nudge. Presentational only — it does not call
 * `beforeinstallprompt` or check platform support; that real logic (and the
 * iOS-vs-Android instructions split) is the Install tab's job, per
 * src/app/(guest)/install/page.tsx's stub comment. This banner just points
 * there and remembers a dismissal.
 */
function InstallBanner({ qs }: { qs: string }) {
  // localStorage doesn't exist during server rendering, so the "was this
  // already dismissed?" read has to resolve differently there than on the
  // client. useSyncExternalStore (rather than an effect + setState, which
  // would trigger the extra cascading render this codebase's
  // react-hooks/set-state-in-effect rule flags) is the documented way to do
  // that: React reconciles the getServerSnapshot() value during hydration
  // and swaps to the real client read in the same pass, with no visible
  // flash and no mismatch warning. Same idiom as src/app/spike/guest/page.tsx's
  // `simulate` flag.
  const dismissedAtLoad = useSyncExternalStore(subscribeNever, readInstallBannerDismissed, () => false);
  // A dismissal *during this session* — the subscribe above never fires, so
  // this local flag is what makes clicking "×" actually hide the banner
  // immediately, on top of persisting for next time.
  const [dismissedNow, setDismissedNow] = useState(false);

  if (dismissedAtLoad || dismissedNow) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, "1");
    } catch {
      // Nothing to persist to — the banner simply reappears next visit.
    }
  };

  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
      style={{ borderColor: BORDER, background: "#F7F8FA", fontFamily: bodyFontFamily }}
    >
      <InstallGlyph />
      <p className="min-w-0 flex-1 text-[12.5px] leading-tight" style={{ color: INK }}>
        Add this to your home screen for one-tap access next time.
      </p>
      <Link
        href={withGuestQuery("/install", qs)}
        className="shrink-0 text-[12.5px] font-semibold"
        style={{ color: "var(--brand-primary)" }}
      >
        Install
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center"
        style={{ color: MUTED }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Collapsible "share with a travel companion" — QR (ShareQr, reused as-is) + copy-link. */
function ShareSection() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission/API can be unavailable — the link is already
      // printed under the QR by ShareQr, so the guest still has a way to
      // grab it by hand.
    }
  };

  return (
    <section className="rounded-xl border" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        <span
          className="text-[14.5px] font-semibold"
          style={{ fontFamily: bodyFontFamily, color: INK }}
        >
          Share with a travel companion
        </span>
        <ChevronGlyph open={open} />
      </button>

      {/* grid-rows 0fr -> 1fr animates height without measuring anything —
          same technique PlaceCard's photo gallery uses. */}
      <div
        aria-hidden={!open}
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="flex flex-col items-center gap-3 px-4 pb-4">
            {open ? <ShareQr size={132} /> : null}
            <button
              type="button"
              onClick={copyLink}
              className="w-full rounded-lg py-2.5 text-[13.5px] font-semibold"
              style={{
                fontFamily: bodyFontFamily,
                border: `1px solid ${BORDER}`,
                color: copied ? "var(--brand-primary)" : INK,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GuestWelcomeScreen({
  brand,
  guideName,
  guideAvatarInitial,
  guideWelcome,
  placeCount,
  topPick,
  qs,
}: GuestWelcomeScreenProps) {
  // Real, persisted save state (src/lib/savedPlaces.ts via
  // src/hooks/useSavedPlaces.ts) — the same store the bottom nav badge and
  // (eventually) the Saved screen read, so saving the top pick here actually
  // shows up there too, rather than a Welcome-only ephemeral toggle.
  const { isSaved, toggle } = useSavedPlaces();

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <InstallBanner qs={qs} />

      {/* Header — guide avatar, app identity, personal welcome quote. */}
      <header
        className="shrink-0 px-6 pb-7 pt-8 text-center text-white"
        style={{ background: "var(--brand-primary)" }}
      >
        <GuideAvatar initial={guideAvatarInitial} />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest opacity-80">
          {brand.companyName}
        </p>
        <h1
          className="mt-1 text-[27px] leading-tight"
          style={{ fontFamily: displayFontFamily }}
        >
          {brand.appName}
        </h1>
        <p
          className="mx-auto mt-4 max-w-[280px] text-[15px] italic leading-snug opacity-95"
          style={{ fontFamily: displayFontFamily }}
        >
          &ldquo;{guideWelcome}&rdquo;
        </p>
        <p className="mt-2 text-[12.5px] opacity-75">— {guideName}</p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        {/* Primary / secondary CTAs */}
        <div>
          <Link
            href={withGuestQuery("/map", qs)}
            className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-white"
            style={{ background: "var(--brand-primary)", fontFamily: bodyFontFamily }}
          >
            Open the map
          </Link>
          <Link
            href={withGuestQuery("/list", qs)}
            className="mt-2.5 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold"
            style={{
              border: `1px solid ${BORDER}`,
              color: INK,
              fontFamily: bodyFontFamily,
            }}
          >
            Browse the list
          </Link>
          {placeCount > 0 ? (
            <p className="mt-2.5 text-center text-[12px]" style={{ color: MUTED }}>
              {placeCount} hand-picked spots from {guideName}, plus boat tours to book.
            </p>
          ) : null}
        </div>

        {/* Pinned top pick — defaults to the featured boat tour. */}
        {topPick ? (
          <div>
            <p
              className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              {guideName}&rsquo;s top pick
            </p>
            <PlaceCard
              item={topPick}
              floating={false}
              saved={isSaved(topPick.id)}
              onToggleSaved={(id) => toggle(id)}
              // Closes over `topPick` (a full MapPin) rather than using the
              // callback's own item argument — PlaceCardItem (PlaceCard's
              // prop type) omits lat/lng, which guestPinActionUrl's walking-
              // directions fallback needs.
              onAction={() =>
                window.open(guestPinActionUrl(topPick), "_blank", "noopener,noreferrer")
              }
            />
          </div>
        ) : null}

        <ShareSection />
      </div>
    </div>
  );
}
