"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import {
  OUTREACH_STATUSES,
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUS_TONES,
  type OutreachStatus,
} from "@/lib/admin/outreachStatus";
import { updateOutreachStatusAction } from "@/lib/admin/outreachActions";

const TONE_CLASSES: Record<"positive" | "neutral" | "warning", string> = {
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  neutral: "bg-[var(--admin-border)] text-[var(--admin-ink-soft)]",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const DOT_CLASSES: Record<"positive" | "neutral" | "warning", string> = {
  positive: "bg-emerald-500",
  neutral: "bg-neutral-400",
  warning: "bg-amber-500",
};

const MENU_WIDTH = 175;

export interface OutreachStatusDropdownProps {
  prospectId: string;
  currentStatus: OutreachStatus;
  align?: "left" | "right";
  className?: string;
}

export default function OutreachStatusDropdown({
  prospectId,
  currentStatus,
  align = "left",
  className = "",
}: OutreachStatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [status, setOptimisticStatus] = useOptimistic(
    currentStatus,
    (_current, nextStatus: OutreachStatus) => nextStatus,
  );
  const [isPending, startTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const top = rect.bottom + 4;
      const left =
        align === "right"
          ? Math.max(8, rect.right - MENU_WIDTH)
          : Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
      setPosition({ top, left });
    }

    place();

    function onDocClick(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, align]);

  function handleSelect(newStatus: OutreachStatus) {
    setOpen(false);
    if (newStatus === status) return;

    startTransition(async () => {
      setOptimisticStatus(newStatus);
      const result = await updateOutreachStatusAction(prospectId, newStatus);
      if (result.error) {
        alert(result.error);
      }
    });
  }

  const tone = OUTREACH_STATUS_TONES[status] ?? "neutral";

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${OUTREACH_STATUS_LABELS[status]}. Click to change.`}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold transition-all hover:opacity-80 active:scale-95 disabled:opacity-50 ${TONE_CLASSES[tone]}`}
      >
        <span>{OUTREACH_STATUS_LABELS[status]}</span>
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin shrink-0 opacity-70" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        )}
      </button>

      {open && position ? (
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: MENU_WIDTH,
            zIndex: 1000,
          }}
          className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 shadow-[var(--admin-shadow-card)] outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-ink-soft)]">
            Change status
          </div>
          {OUTREACH_STATUSES.map((opt) => {
            const isSelected = opt === status;
            const itemTone = OUTREACH_STATUS_TONES[opt];
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-[var(--admin-bg)] ${
                  isSelected ? "font-semibold text-[var(--admin-ink)]" : "text-[var(--admin-ink-soft)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[itemTone]}`} />
                  <span>{OUTREACH_STATUS_LABELS[opt]}</span>
                </div>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--admin-accent)]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
