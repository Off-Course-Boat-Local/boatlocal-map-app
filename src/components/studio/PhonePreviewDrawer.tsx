"use client";

// The guide's preview: a sidebar button that slides the phone in from the
// right, instead of the permanently-docked panel companies get.
//
// WHY A SIDEBAR BUTTON rather than one per page: a guide's guest view is fed
// by two different pages — Profile (their photo, their welcome message) and
// Recommendations (their picks) — so a page-level button would have to be
// built twice and would compete with each page's real primary action ("Add
// place", "Save profile"). One stable spot in the sidebar is reachable from
// both, and from the Dashboard too.
//
// Unlike the company panel this does NOT stay open while editing, so it is
// mounted only while open: the preview holds a live WebGL map, and keeping a
// second one alive behind a closed drawer costs a GPU context for nothing.

import { useEffect, useState } from "react";

import PhonePreview from "./PhonePreview";
import type { MapPin } from "@/lib/data";

export interface PhonePreviewDrawerProps {
  pins: MapPin[];
  /** e.g. "14 picks curated by Jan" */
  subtitle: string;
}

export default function PhonePreviewDrawer({ pins, subtitle }: PhonePreviewDrawerProps) {
  const [open, setOpen] = useState(false);

  // Escape closes, and the page behind must not scroll under the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--studio-border)] px-3 py-2 text-sm font-semibold text-[var(--studio-ink-soft)] transition-colors hover:bg-[var(--studio-bg)] hover:text-[var(--studio-ink)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="7"
            y="2.5"
            width="10"
            height="19"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M10.75 5.5h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Preview
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Guest app preview">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />

          <div className="relative flex h-full w-[380px] max-w-[90vw] flex-col gap-3 overflow-y-auto border-l border-[var(--studio-border)] bg-[var(--studio-bg)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--studio-ink-soft)] uppercase">
                Guest preview
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close preview"
                className="-mr-1 rounded p-1 text-[var(--studio-ink-soft)] hover:text-[var(--studio-ink)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <PhonePreview pins={pins} subtitle={subtitle} />

            <p className="mx-auto max-w-[260px] text-center text-[11px] leading-relaxed text-[var(--studio-ink-soft)]">
              How your link looks to a guest. Your company sets the colours and
              app name; your picks and welcome message are yours.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
