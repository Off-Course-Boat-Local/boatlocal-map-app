"use client";

// A per-row kebab (three-dot) action menu — for tables where several row
// actions (view / status change / delete) would otherwise crowd the last
// column with a wall of small buttons. Shared Admin/Studio component like
// PortalSelect/PortalModal/PortalIcons beside it (see MapAppMark.tsx's
// header comment for why Admin and Studio share one design system).
//
// Rendered with `position: fixed` at coordinates measured from the trigger
// button on open, NOT `position: absolute` inside the row — AdminTable's
// wrapper is `overflow-x-auto`, and per the CSS overflow spec, setting only
// `overflow-x` on an element computes its `overflow-y` to `auto` too (never
// left as `visible`). An absolutely-positioned menu would get clipped by
// that box for any row whose menu doesn't fit in the remaining scroll
// height. Fixed positioning escapes that ancestor entirely. The trade-off:
// it closes on scroll rather than tracking the trigger, which is the
// standard, acceptable behaviour for this pattern (matches how a native
// <select>'s popup or a browser menu behaves under scroll).

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";

import { MoreIcon } from "./PortalIcons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export interface PortalRowMenuItem {
  label: string;
  icon: IconType;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export interface PortalRowMenuProps {
  items: PortalRowMenuItem[];
  /** Accessible label for the trigger button, e.g. "Actions for Boat & Bike Co." */
  label: string;
}

const FALLBACK_BORDER = "#D4D4D4";
const FALLBACK_SURFACE = "#FFFFFF";
const FALLBACK_INK = "#171717";
const FALLBACK_INK_SOFT = "#737373";
const FALLBACK_HOVER_BG = "#F5F5F4";
const MENU_WIDTH = 200;

export default function PortalRowMenu({ items, label }: PortalRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        // Right-align the menu's right edge with the trigger's right edge
        // so it never runs off the right side of the viewport, then clamp
        // its left edge to stay on-screen too (a trigger near the left
        // edge of a wide, horizontally-scrolled table).
        left: Math.max(8, rect.right - MENU_WIDTH),
      });
    }

    place();

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Closing on scroll (rather than re-measuring) is the trade-off called
    // out in this file's header comment for using fixed positioning.
    function onScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="rounded-md p-1.5 transition-colors"
        style={{ color: `var(--admin-ink-soft, ${FALLBACK_INK_SOFT})` }}
        onMouseEnter={(e) => (e.currentTarget.style.background = `var(--admin-bg, ${FALLBACK_HOVER_BG})`)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <MoreIcon />
      </button>

      {open && position ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className="fixed z-50 overflow-hidden rounded-md border py-1 text-sm shadow-lg"
          style={{
            top: position.top,
            left: position.left,
            width: MENU_WIDTH,
            borderColor: `var(--admin-border, ${FALLBACK_BORDER})`,
            background: `var(--admin-surface, ${FALLBACK_SURFACE})`,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const danger = item.tone === "danger";
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: danger ? "#DC2626" : `var(--admin-ink, ${FALLBACK_INK})` }}
                onMouseEnter={(e) => {
                  if (!item.disabled) e.currentTarget.style.background = `var(--admin-bg, ${FALLBACK_HOVER_BG})`;
                }}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon width={16} height={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
