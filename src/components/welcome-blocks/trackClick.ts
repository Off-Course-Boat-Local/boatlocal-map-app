"use client";

// Fire-and-forget click tracking for welcome-hub blocks (review links, booking
// links). Same event path as the Map/List screens: recordGuestEvent swallows
// its own errors and drops Studio-preview clicks, so this never blocks a tap.

import { recordGuestEvent } from "@/lib/guestEvents";
import type { EventType } from "@/lib/data/types";
import { detectInstallPlatform, installPlatformToEventPlatform } from "@/lib/installPlatform";
import type { WelcomeBlockContext } from "./context";

export function trackWelcomeClick(
  ctx: WelcomeBlockContext,
  eventType: EventType,
  extra?: { boatTourId?: string; metadata?: Record<string, unknown> },
): void {
  if (!ctx.companyId) return;
  recordGuestEvent({
    eventType,
    companyId: ctx.companyId,
    guideId: ctx.guideId ?? null,
    boatTourId: extra?.boatTourId,
    platform: installPlatformToEventPlatform(
      detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
    ),
    metadata: { source: "welcome", ...extra?.metadata },
  }).catch(() => {});
}
