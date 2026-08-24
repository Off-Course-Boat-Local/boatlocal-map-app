"use client";

// The docked "live phone preview" PRD §7 asks for — COMPANY ROLE ONLY.
//
// Why only companies: the panel earns a permanent 460px because a company
// editing Branding needs to watch colours change as they pick them (that
// live loop is the whole point of StudioPreviewContext). A guide controls
// none of that styling — only their welcome text, their photo and their
// picks — so a preview they can't drive is just width taken away from the
// tables and forms they came to use. Founder's call: "the live preview
// should just be for companies, not guides. Guides don't determine how the
// map or those links would look." Guides get PhonePreviewDrawer.tsx instead
// — same preview, opened from the sidebar when they actually want it.
//
// Still hidden below `xl`: a phone-shaped preview competes for width with
// the actual Studio content on anything narrower, and Studio must stay
// usable on a laptop.

import PhonePreview from "./PhonePreview";
import type { MapPin } from "@/lib/data";

export interface PhonePreviewPanelProps {
  pins: MapPin[];
  /** e.g. "14 picks across Boat & Bike Co." */
  subtitle: string;
}

export default function PhonePreviewPanel({ pins, subtitle }: PhonePreviewPanelProps) {
  return (
    <aside
      className="hidden shrink-0 flex-col gap-3 overflow-y-auto border-l border-[var(--studio-border)] bg-[var(--studio-bg)] p-6 xl:flex xl:w-[460px]"
      aria-label="Live guest app preview"
    >
      <p className="text-center text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--studio-ink-soft)] uppercase">
        Live preview
      </p>

      <PhonePreview pins={pins} subtitle={subtitle} />

      <p className="mx-auto max-w-[260px] text-center text-[11px] leading-relaxed text-[var(--studio-ink-soft)]">
        Mirrors what a guest sees right now. Updates live as branding is edited.
      </p>
    </aside>
  );
}
