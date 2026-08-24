"use client";

// The real Install (PWA "Add to Home Screen") screen — PRD §5.7.
//
// iOS never fires `beforeinstallprompt` (Apple's decision, not a bug), so
// there is no one-tap install button possible there — only manual
// Share-sheet steps. Android Chrome (and most Chromium-based browsers) do
// fire it, so there we can offer a real one-tap button and fall back to
// manual steps only if the browser doesn't cooperate. See
// src/lib/installPlatform.ts for the (UA-sniffed, deliberately-so) platform
// detection this reads.
//
// VISUALS follow the reference design's install screen (nice-notice's
// src/routes/install.tsx): gradient header band, an app-identity card, a
// segmented iPhone/Android toggle, numbered step cards, and a full-width
// pill CTA for the one-tap path. The toggle only OVERRIDES which step list
// is displayed — detection still decides the default and all install/
// analytics wiring is untouched.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Download, QrCode } from "lucide-react";

import { GuestScreenHeader } from "./GuestScreenHeader";
import { useIsDesktopPointer } from "@/hooks/useIsDesktopPointer";
import { useIsStandalone } from "@/hooks/useIsStandalone";
import { displayFontFamily, bodyFontFamily } from "@/lib/fonts";
import { recordGuestEvent } from "@/lib/guestEvents";
import {
  BORDER,
  BRAND_GRADIENT,
  BRAND_SOFT,
  INK,
  MUTED,
  SECONDARY,
  SHADOW_CARD,
} from "@/lib/guestTheme";
import {
  detectInstallPlatform,
  installPlatformToEventPlatform,
  type InstallPlatform,
} from "@/lib/installPlatform";
import type { Brand } from "@/lib/types";

/** Not in lib.dom.d.ts yet in every TS lib target we ship against. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Environment, not state — read during render via useSyncExternalStore
// (same pattern as src/hooks/useGuestLocation.ts's readGeoSupport) rather
// than pushed into state from an effect. That avoids both a "flash of the
// wrong platform" on mount AND a synchronous setState-in-effect, since
// useSyncExternalStore's server snapshot keeps SSR/hydration consistent and
// its client snapshot is already correct on the very first client render.
const noopSubscribe = () => () => {};

function getPlatformSnapshot(): InstallPlatform {
  return detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
}
function getPlatformServerSnapshot(): InstallPlatform {
  return "other";
}

export interface InstallScreenProps {
  brand: Brand;
  companyId: string | null;
}

export default function InstallScreen({ brand, companyId }: InstallScreenProps) {
  const platform = useSyncExternalStore(
    noopSubscribe,
    getPlatformSnapshot,
    getPlatformServerSnapshot,
  );
  const standalone = useIsStandalone();
  // True for a mouse/trackpad-driven browser — what the "scan this QR code
  // with your phone's camera" fallback actually assumes about the reader.
  // NOT the same question as `platform === "other"` — see
  // useIsDesktopPointer's own header comment for why.
  const isDesktop = useIsDesktopPointer();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  // The segmented toggle's manual override — null means "trust detection".
  const [platformOverride, setPlatformOverride] = useState<"ios" | "android" | null>(null);

  // A genuine subscription to two external events (with cleanup) — the
  // textbook case an effect is for, unlike the platform/standalone reads
  // above.
  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      // Stop Chrome's own mini-infobar; we show our own button instead so
      // the copy/branding matches the rest of this screen.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setJustInstalled(true);
      setDeferredPrompt(null);
      recordGuestEvent({
        eventType: "app_install",
        companyId,
        platform: installPlatformToEventPlatform(platform),
      }).catch(() => {});
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [companyId, platform]);

  async function handleOneTapInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setJustInstalled(true);
  }

  const isMobilePlatform = platform === "ios" || platform === "android";
  const displayedPlatform: "ios" | "android" =
    platformOverride ?? (platform === "android" ? "android" : "ios");

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ fontFamily: bodyFontFamily, color: INK }}
    >
      <GuestScreenHeader
        eyebrow="Two taps"
        title="Keep this on your phone"
        subtitle={`${brand.appName} on your home screen — no app store, no account.`}
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6">
        {/* App-identity card — what lands on the home screen. */}
        <div
          className="flex items-center gap-4 rounded-2xl p-4"
          style={{ border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD }}
        >
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-semibold text-white"
            style={{ background: BRAND_GRADIENT, fontFamily: displayFontFamily }}
            aria-hidden="true"
          >
            {appInitials(brand.appName)}
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-base font-semibold"
              style={{ margin: 0, fontFamily: displayFontFamily }}
            >
              {brand.appName}
            </p>
            <p className="text-[0.8125rem]" style={{ margin: 0, color: MUTED }}>
              Local guide · full screen
            </p>
          </div>
        </div>

        <div className="mt-6">
          {standalone || justInstalled ? (
            <StatusCard tone="success">
              {justInstalled
                ? `You're set — ${brand.appName} is on your home screen.`
                : `You're already using the installed app. Nicely done.`}
            </StatusCard>
          ) : isMobilePlatform ? (
            <div>
              {/* Segmented platform toggle — detection picks the default,
                  this only switches which instructions are DISPLAYED. */}
              <div
                className="mb-4 inline-flex rounded-full p-1"
                style={{ background: SECONDARY }}
              >
                {(["ios", "android"] as const).map((p) => {
                  const selected = displayedPlatform === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatformOverride(p)}
                      aria-pressed={selected}
                      className="h-9 rounded-full px-4 text-[0.8125rem] font-semibold"
                      style={{
                        fontFamily: bodyFontFamily,
                        cursor: "pointer",
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                        ...(selected
                          ? { background: "var(--brand-primary)", color: "#FFFFFF" }
                          : { background: "transparent", color: MUTED }),
                      }}
                    >
                      {p === "ios" ? "iPhone" : "Android"}
                    </button>
                  );
                })}
              </div>

              {displayedPlatform === "ios" ? (
                <IosSteps />
              ) : (
                <AndroidSteps
                  canOneTap={deferredPrompt !== null}
                  onInstall={handleOneTapInstall}
                />
              )}
            </div>
          ) : isDesktop ? (
            // Only a genuine mouse/trackpad browser gets told to scan a QR
            // code with "your phone's camera" — that instruction assumes the
            // reader isn't holding a phone. See isDesktopPointer's doc
            // comment for why `platform === "other"` alone isn't a safe
            // enough signal for that assumption (it also matches a real
            // guest on some other/unusual mobile browser).
            <DesktopScanCard />
          ) : (
            // A touch-primary device we couldn't specifically classify as
            // iOS or Android — still a phone/tablet, so generic (not
            // "scan with your phone") instructions.
            <StatusCard tone="neutral">
              Open your browser&rsquo;s menu and look for &ldquo;Add to Home
              Screen&rdquo; or &ldquo;Install app&rdquo; to add {brand.appName}{" "}
              here.
            </StatusCard>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Jan's Amsterdam" → "JA" — the home-screen tile initials. */
function appInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function StatusCard({
  tone,
  children,
}: {
  tone: "success" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-sm leading-relaxed"
      style={{
        background: tone === "success" ? "#F0F9F1" : SECONDARY,
        color: tone === "success" ? "#1E5636" : INK,
        border: `1px solid ${tone === "success" ? "#CDE9CF" : BORDER}`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The desktop branch's "scan the QR code" moment — a proper SHADOW_CARD
 * card (soft-circle QrCode badge, Outfit mini-heading, micro-steps) rather
 * than a flat info box, echoing the visual language of the phone StepRows.
 */
function DesktopScanCard() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        boxShadow: SHADOW_CARD,
      }}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
          style={{ background: BRAND_SOFT }}
        >
          <QrCode
            className="h-5 w-5"
            strokeWidth={1.75}
            style={{ color: "var(--brand-primary)" }}
          />
        </span>
        <div className="min-w-0">
          <p
            className="text-[0.9375rem] font-semibold"
            style={{ margin: 0, color: INK, fontFamily: displayFontFamily }}
          >
            Scan to install
          </p>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ margin: 0, marginTop: 4, color: MUTED, fontFamily: bodyFontFamily }}
          >
            This lives on a phone, not a desktop. Your QR code is in the panel
            beside this screen.
          </p>
        </div>
      </div>

      {/* Micro-steps — same numbered-circle language as the phone StepRows,
          scaled down to fit inside one card. */}
      <ol
        className="mt-4 flex flex-col gap-2.5 border-t pt-4"
        style={{ borderColor: BORDER, margin: 0, marginTop: 16, padding: 0, paddingTop: 16 }}
      >
        <MicroStep index={1}>
          Point your phone&rsquo;s camera at the QR code in the side panel.
        </MicroStep>
        <MicroStep index={2}>Tap the link that pops up on your phone.</MicroStep>
        <MicroStep index={3}>Follow the install steps from there.</MicroStep>
      </ol>
    </div>
  );
}

function MicroStep({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold"
        style={{ background: BRAND_SOFT, color: "var(--brand-primary)" }}
      >
        {index}
      </span>
      <span
        className="min-w-0 pt-0.5 text-sm leading-relaxed"
        style={{ color: MUTED, fontFamily: bodyFontFamily }}
      >
        {children}
      </span>
    </li>
  );
}

function StepRow({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      className="flex items-start gap-3 rounded-2xl p-5 text-left"
      style={{ border: `1px solid ${BORDER}`, boxShadow: SHADOW_CARD, background: "#FFFFFF" }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.8125rem] font-semibold"
        style={{ background: BRAND_SOFT, color: "var(--brand-primary)" }}
      >
        {index}
      </span>
      <span className="min-w-0">
        <span
          className="block text-[0.9375rem] font-semibold"
          style={{ color: INK, fontFamily: displayFontFamily }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-sm leading-relaxed"
          style={{ color: MUTED, fontFamily: bodyFontFamily }}
        >
          {children}
        </span>
      </span>
    </li>
  );
}

/** The share-sheet glyph every iOS browser uses (a box with an arrow up out of it) — drawn once here rather than pulled in as an icon font. */
function ShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "-3px" }}
    >
      <path
        d="M12 3v11M8 7l4-4 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IosSteps() {
  return (
    <ol className="flex flex-col gap-3">
      <StepRow index={1} title="Open the Share menu">
        Tap the Share icon <ShareGlyph /> in the browser toolbar.
      </StepRow>
      <StepRow index={2} title="Add to Home Screen">
        Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
      </StepRow>
      <StepRow index={3} title="Confirm">
        Tap <strong>&ldquo;Add&rdquo;</strong> in the top right.
      </StepRow>
    </ol>
  );
}

function AndroidSteps({
  canOneTap,
  onInstall,
}: {
  canOneTap: boolean;
  onInstall: () => void;
}) {
  if (canOneTap) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Your browser can install this in one tap.
        </p>
        <button
          type="button"
          onClick={onInstall}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
          style={{
            background: "var(--brand-primary)",
            fontFamily: bodyFontFamily,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Add to Home Screen
        </button>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      <StepRow index={1} title="Open the browser menu">
        Tap the <strong>⋮</strong> menu in the top right of the browser.
      </StepRow>
      <StepRow index={2} title="Add to Home screen">
        Tap <strong>&ldquo;Add to Home screen&rdquo;</strong> (or &ldquo;Install
        app&rdquo;).
      </StepRow>
      <StepRow index={3} title="Confirm">
        Confirm with <strong>&ldquo;Add&rdquo;</strong> / <strong>&ldquo;Install&rdquo;</strong>.
      </StepRow>
    </ol>
  );
}
