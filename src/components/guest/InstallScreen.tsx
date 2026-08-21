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

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { displayFontFamily, bodyFontFamily } from "@/lib/fonts";
import { recordGuestEvent } from "@/lib/guestEvents";
import {
  detectInstallPlatform,
  installPlatformToEventPlatform,
  type InstallPlatform,
} from "@/lib/installPlatform";
import type { Brand } from "@/lib/types";

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

/** Not in lib.dom.d.ts yet in every TS lib target we ship against. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneDisplay(): boolean {
  const iosStandalone = (navigator as unknown as { standalone?: boolean })
    .standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosStandalone === true
  );
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

function getStandaloneSnapshot(): boolean {
  return isStandaloneDisplay();
}
function getStandaloneServerSnapshot(): boolean {
  return false;
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
  const standalone = useSyncExternalStore(
    noopSubscribe,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot,
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

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

  return (
    <div
      className="no-scrollbar flex h-full flex-col overflow-y-auto px-6 pb-8 pt-8 text-center"
      style={{ fontFamily: bodyFontFamily, color: INK }}
    >
      <h1
        className="text-2xl leading-tight"
        style={{ fontFamily: displayFontFamily }}
      >
        Install {brand.appName}
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed" style={{ color: MUTED }}>
        Add it to your home screen — it opens straight to the map, no app
        store needed.
      </p>

      <div className="mx-auto mt-8 w-full max-w-xs">
        {standalone || justInstalled ? (
          <StatusCard tone="success">
            {justInstalled
              ? `You're set — ${brand.appName} is on your home screen.`
              : `You're already using the installed app. Nicely done.`}
          </StatusCard>
        ) : platform === "ios" ? (
          <IosSteps />
        ) : platform === "android" ? (
          <AndroidSteps
            canOneTap={deferredPrompt !== null}
            onInstall={handleOneTapInstall}
          />
        ) : (
          <StatusCard tone="neutral">
            This works best on a phone. Scan the QR code in the panel beside
            this screen with your phone&rsquo;s camera, then install it from
            there.
          </StatusCard>
        )}
      </div>
    </div>
  );
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
        background: tone === "success" ? "#F0F9F1" : "#F5F5F4",
        color: tone === "success" ? "#1E5636" : INK,
        border: `1px solid ${tone === "success" ? "#CDE9CF" : BORDER}`,
      }}
    >
      {children}
    </div>
  );
}

function StepRow({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
        style={{ background: "var(--brand-primary)" }}
      >
        {index}
      </span>
      <span className="text-sm leading-relaxed" style={{ color: INK }}>
        {children}
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
    <ol className="flex flex-col gap-4">
      <StepRow index={1}>
        Tap the Share icon <ShareGlyph /> in the browser toolbar.
      </StepRow>
      <StepRow index={2}>
        Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
      </StepRow>
      <StepRow index={3}>
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
          className="h-11 w-full rounded-xl text-[15px] font-semibold text-white"
          style={{ background: "var(--brand-primary)", fontFamily: bodyFontFamily }}
        >
          Add to Home Screen
        </button>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      <StepRow index={1}>
        Tap the <strong>⋮</strong> menu in the top right of the browser.
      </StepRow>
      <StepRow index={2}>
        Tap <strong>&ldquo;Add to Home screen&rdquo;</strong> (or &ldquo;Install
        app&rdquo;).
      </StepRow>
      <StepRow index={3}>
        Confirm with <strong>&ldquo;Add&rdquo;</strong> / <strong>&ldquo;Install&rdquo;</strong>.
      </StepRow>
    </ol>
  );
}
