"use client";

// PhoneFrame — the desktop treatment for the guest app.
//
// The guest app is a phone app. On a phone we render it edge to edge and
// this component gets out of the way entirely. On a desktop we render it
// inside a phone-shaped frame rather than stretching a 375px-wide design
// across a 27" monitor.
//
// The empty space beside the frame is not decoration: almost everyone who
// opens a guest link on a desktop (a hotel manager evaluating it, a guide
// previewing their own guide, someone demoing it to a partner) wants it on
// their phone. So the surround carries the brand and a "scan to open on
// your phone" slot.
//
// Deliberately NOT included: a fake status bar with a fake time. That's a
// mockup convention; showing a real user a fake 9:41 is just odd.

import type { ReactNode } from "react";

import { usePhoneViewportHeight } from "@/hooks/usePhoneViewportHeight";

export interface PhoneFrameProps {
  children: ReactNode;
  /** Rendered in the surround beside the frame. Desktop only. */
  aside?: ReactNode;
  /** Breakpoint below which the frame disappears entirely. */
  className?: string;
}

export default function PhoneFrame({
  children,
  aside,
  className,
}: PhoneFrameProps) {
  // Harmless to call unconditionally, including on the desktop breakpoint
  // where the --app-vh it writes is simply never read (md:h-dvh below
  // wins there regardless — see the hook's own header comment for why
  // this exists at all).
  usePhoneViewportHeight();

  return (
    <div
      className={[
        // Phone: plain full-bleed app, no frame, no surround. Falls back
        // to plain 100dvh wherever usePhoneViewportHeight is a no-op
        // (desktop, or any browser without visualViewport).
        "h-[var(--app-vh,100dvh)] w-full",
        // Desktop: centre the frame on the brand surround. Tailwind emits
        // md: utilities in a later @media block, so this wins over the
        // base h-[var(--app-vh,...)] class above at that breakpoint
        // regardless of source order.
        "md:flex md:h-dvh md:items-center md:justify-center md:gap-12 md:p-10",
        className ?? "",
      ].join(" ")}
      style={{ background: "var(--brand-surround, #F6F6F3)" }}
    >
      <div
        className={[
          "relative h-full w-full overflow-hidden bg-white",
          // The frame itself — subtle, not a photoreal handset.
          "md:h-[812px] md:max-h-[92vh] md:w-[375px] md:shrink-0",
          "md:rounded-[2.25rem] md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]",
          "md:ring-[10px] md:ring-neutral-900",
        ].join(" ")}
      >
        {children}
      </div>

      {aside ? (
        <div className="hidden md:block md:max-w-xs">{aside}</div>
      ) : null}
    </div>
  );
}
