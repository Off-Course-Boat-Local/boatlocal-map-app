"use client";

// Records exactly one "app_open" event per browser tab session.
//
// WHY THIS EXISTS: `app_open` has been a defined EventType (src/lib/data/
// types.ts) and Postgres enum value since the schema was written, but
// nothing anywhere ever fired it before this — the Studio dashboard's
// "App opens" KPI (now a real sum, see src/lib/studio/dashboardAnalytics.ts)
// had no tracking behind it until this call site existed.
//
// WHY sessionStorage, NOT a plain useEffect(() => {...}, []): this mounts
// inside src/app/(guest)/layout.tsx, which — being a shared layout — does
// NOT remount on client-side navigation between /map, /list, /saved (that
// persistence is the whole point of a layout in the App Router). So a bare
// mount-effect would already fire once per real app open, not once per
// screen. The sessionStorage guard exists for two narrower reasons instead:
//   1. React StrictMode double-invokes effects on mount in dev, which would
//      double-count every local dev session without a guard.
//   2. It gives "app open" an honest definition — once per browser tab,
//      until that tab closes — rather than "once per this particular
//      React component instance's lifetime", which would double-count if
//      this component ever ends up remounted for an unrelated reason (e.g.
//      a future layout restructure) without anyone revisiting this file.
//
// Preview suppression is NOT duplicated here: recordGuestEvent
// (src/lib/guestEvents.ts) already calls isPreviewRequest() and no-ops for
// Studio's preview, exactly like every other guest event.

import { useEffect } from "react";

import { recordGuestEvent } from "@/lib/guestEvents";
import { detectInstallPlatform, installPlatformToEventPlatform } from "@/lib/installPlatform";

const SESSION_STORAGE_KEY = "bkl_app_open_recorded";

export interface GuestAppOpenTrackerProps {
  companyId: string | null;
  guideId: string | null;
}

export default function GuestAppOpenTracker({ companyId, guideId }: GuestAppOpenTrackerProps) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_STORAGE_KEY) === "1") return;
      sessionStorage.setItem(SESSION_STORAGE_KEY, "1");
    } catch {
      // Private-browsing Safari throws on sessionStorage access in some
      // versions — fall through and record anyway rather than losing the
      // event entirely; worst case is an extra count in that rare case,
      // not a missing one.
    }

    recordGuestEvent({
      eventType: "app_open",
      companyId,
      guideId,
      platform: installPlatformToEventPlatform(
        detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
      ),
    }).catch(() => {});
    // Runs once per mount by design — see this file's header comment for
    // why that already means "once per real app open," not "once per
    // screen," given where this is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
