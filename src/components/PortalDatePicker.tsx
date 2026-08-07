"use client";

// A custom calendar-popover date picker for the shared Admin/Studio portal
// design — replaces the native <input type="date"> (an OS-drawn control
// whose look varies per browser and can't be restyled) with a proper
// on-brand calendar. See PortalSelect.tsx's header comment for the shared
// "hidden input carries the real value" approach that lets this drop into
// an existing plain `<form method="get">` unchanged.
//
// The hidden input's value is always `yyyy-mm-dd` — exactly what a native
// `<input type="date">` used to submit — so nothing downstream
// (src/lib/admin/dateRange.ts's `parseDateRangeParams`) needed to change.

import { useEffect, useMemo, useRef, useState } from "react";

export interface PortalDatePickerProps {
  name: string;
  /** `yyyy-mm-dd`, matching a native `<input type="date">`'s value. */
  defaultValue?: string;
  placeholder?: string;
  /** Applied to the visible trigger button, so a `<label htmlFor={id}>` still associates correctly. */
  id?: string;
  className?: string;
}

const FALLBACK_BORDER = "#D4D4D4";
const FALLBACK_SURFACE = "#FFFFFF";
const FALLBACK_INK = "#171717";
const FALLBACK_INK_SOFT = "#6B7280";
const FALLBACK_ACCENT = "#1B5FE3";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromIso(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function PortalDatePicker({
  name,
  defaultValue,
  placeholder = "dd/mm/yyyy",
  id,
  className,
}: PortalDatePickerProps) {
  const initial = defaultValue ? fromIso(defaultValue) : null;
  const [selected, setSelected] = useState<Date | null>(initial);
  const [viewDate, setViewDate] = useState<Date>(initial ?? new Date());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // See PortalSelect.tsx's identical effect for why: a native `form.reset()`
  // resets the hidden input's DOM value but not the React state driving
  // this component's visible label/calendar.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      const resetTo = defaultValue ? fromIso(defaultValue) : null;
      setSelected(resetTo);
      setViewDate(resetTo ?? new Date());
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startWeekday + 1;
      // Date normalizes an out-of-range day into the adjacent month, which
      // is exactly the leading/trailing filler a calendar grid needs.
      const date = new Date(year, month, dayNum);
      return { date, inMonth: dayNum >= 1 && dayNum <= daysInMonth };
    });
  }, [viewDate]);

  const todayIso = toIso(new Date());
  const selectedIso = selected ? toIso(selected) : "";

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <input type="hidden" name={name} value={selectedIso} />

      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm outline-none"
        style={{
          borderColor: `var(--admin-border, ${FALLBACK_BORDER})`,
          background: `var(--admin-surface, ${FALLBACK_SURFACE})`,
          color: `var(--admin-ink, ${FALLBACK_INK})`,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 opacity-60">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span style={{ opacity: selected ? 1 : 0.5 }}>{selected ? formatDisplay(selected) : placeholder}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute z-20 mt-1 w-64 rounded-lg border p-3 shadow-lg"
          style={{
            borderColor: `var(--admin-border, ${FALLBACK_BORDER})`,
            background: `var(--admin-surface, ${FALLBACK_SURFACE})`,
            color: `var(--admin-ink, ${FALLBACK_INK})`,
          }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:opacity-70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm font-semibold">
              {MONTH_LABELS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:opacity-70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[11px]" style={{ color: `var(--admin-ink-soft, ${FALLBACK_INK_SOFT})` }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={`${w}-${i}`}>{w}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {cells.map(({ date, inMonth }) => {
              const iso = toIso(date);
              const isSelected = iso === selectedIso;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setSelected(date);
                    setOpen(false);
                  }}
                  className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs"
                  style={{
                    opacity: inMonth ? 1 : 0.35,
                    background: isSelected ? `var(--admin-accent, ${FALLBACK_ACCENT})` : "transparent",
                    color: isSelected ? "#FFFFFF" : `var(--admin-ink, ${FALLBACK_INK})`,
                    border: isToday && !isSelected ? `1px solid var(--admin-accent, ${FALLBACK_ACCENT})` : "1px solid transparent",
                    fontWeight: isSelected || isToday ? 600 : 400,
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setOpen(false);
              }}
              className="mt-2 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PortalDatePicker;
