"use client";

// Keeps a `--app-vh` custom property in sync with the REAL visible
// viewport on iOS Safari, as a fallback layered under 100dvh rather than a
// replacement for it — see PhoneFrame.tsx, which uses
// `h-[var(--app-vh,100dvh)]` (falls straight back to plain 100dvh
// everywhere this hook is a no-op: desktop, and any browser without
// `visualViewport`).
//
// WHY THIS EXISTS: 100dvh is *supposed* to track the live visual viewport
// as Safari's own chrome (address bar) collapses/expands, but WebKit only
// reflows it on discrete triggers, not continuously — so a dvh-sized
// element can be measured a beat before the real viewport finishes
// settling. Combined with html/body's own overflow:hidden lock
// (globals.css), that transient mismatch used to be exactly the room a
// stray touch or Safari's own chrome-collapse animation needed to scroll
// the whole document — carrying the guest app's bottom nav below the fold
// with it (founder report, 2026-09-02, screenshotted live on an iPhone:
// "both menu items disappear behind the mobile browsers UI"). The
// `visualViewport` API is the one thing on iOS Safari that reports the
// REAL visible height continuously, which is what this hook mirrors into
// CSS so layout can react to it directly instead of waiting on dvh's own
// reflow timing.
//
// rAF-COALESCED, NOT PER-EVENT — non-negotiable: `visualViewport.scroll`
// fires very frequently during the chrome-collapse animation, and
// BaseMap.tsx's own ResizeObserver retriggers `google.maps.event.trigger
// (instance, "resize")` on every container resize. Writing this property
// on every raw event would retrigger a Maps resize repeatedly during a
// live "greedy" pan gesture — a real, visible map-jump risk, not just
// layout thrash. At most one write per animation frame avoids that.

import { useEffect } from "react";

export function usePhoneViewportHeight(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let rafId: number | null = null;

    const writeHeight = () => {
      rafId = null;
      document.documentElement.style.setProperty("--app-vh", `${viewport.height}px`);
    };

    const scheduleWrite = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(writeHeight);
    };

    scheduleWrite();
    viewport.addEventListener("resize", scheduleWrite);
    viewport.addEventListener("scroll", scheduleWrite);
    window.addEventListener("orientationchange", scheduleWrite);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      viewport.removeEventListener("resize", scheduleWrite);
      viewport.removeEventListener("scroll", scheduleWrite);
      window.removeEventListener("orientationchange", scheduleWrite);
    };
  }, []);
}
