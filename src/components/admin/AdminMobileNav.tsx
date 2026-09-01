"use client";

// The mobile/tablet counterpart to AdminSidebar's permanent desktop rail
// (hidden below `lg`, see that file) — founder request, 2026-09-01: "make
// all environments responsive, also the studio". Exact same pattern as
// Studio's own StudioMobileNav.tsx: a slim top bar with a hamburger button
// opens the same nav (AdminSidebar with `variant="drawer"`) as a
// left-sliding overlay — one nav config/markup, not two.

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import MapAppMark from "@/components/MapAppMark";
import AdminSidebar from "./AdminSidebar";

export interface AdminMobileNavProps {
  email: string;
  onLogoutAction: () => Promise<void>;
}

export default function AdminMobileNav({ email, onLogoutAction }: AdminMobileNavProps) {
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
        className="flex shrink-0 items-center justify-between border-b border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] px-4 py-3 lg:hidden"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <MapAppMark iconSize={22} className="font-display text-[var(--admin-sidebar-ink)]" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-[var(--admin-sidebar-ink)] hover:bg-[var(--admin-bg)]"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
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
                className="rounded-lg p-1.5 text-[var(--admin-sidebar-ink-dim)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-sidebar-ink)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <AdminSidebar
              email={email}
              onLogoutAction={onLogoutAction}
              variant="drawer"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
