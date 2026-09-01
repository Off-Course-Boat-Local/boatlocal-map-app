"use client";

// The mobile/tablet counterpart to StudioSidebar's permanent desktop rail
// (hidden below `lg`, see that file) — founder request, 2026-09-01: "make
// all environments responsive, also the studio". A slim top bar with a
// hamburger button that opens the exact same nav (StudioSidebar rendered
// with `variant="drawer"`) as a left-sliding overlay, so there is still
// only one nav config/markup to maintain — same "one Studio, not two"
// principle StudioSidebar's own header comment already documents for the
// company/guide split.
//
// Slide-from-left + backdrop + Escape-to-close + body-scroll-lock mirrors
// PhonePreviewDrawer.tsx's existing pattern almost exactly (that one slides
// from the right, for a preview rather than navigation).

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import MapAppMark from "@/components/MapAppMark";
import StudioSidebar from "./StudioSidebar";
import type { StudioNavItem } from "@/lib/studio/nav";

export interface StudioMobileNavProps {
  items: StudioNavItem[];
  roleLabel: string;
  name: string;
}

export default function StudioMobileNav({ items, roleLabel, name }: StudioMobileNavProps) {
  const [open, setOpen] = useState(false);

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
      <header
        className="flex shrink-0 items-center justify-between border-b border-[var(--studio-sidebar-border)] bg-[var(--studio-sidebar-bg)] px-4 py-3 lg:hidden"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <MapAppMark iconSize={22} className="text-[var(--studio-sidebar-ink)]" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-[var(--studio-sidebar-ink)] hover:bg-[var(--studio-bg)]"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Studio navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />

          <div className="relative flex h-full w-72 max-w-[85vw] flex-col shadow-2xl">
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-[var(--studio-sidebar-ink-dim)] hover:bg-[var(--studio-bg)] hover:text-[var(--studio-sidebar-ink)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <StudioSidebar
              items={items}
              roleLabel={roleLabel}
              name={name}
              variant="drawer"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
