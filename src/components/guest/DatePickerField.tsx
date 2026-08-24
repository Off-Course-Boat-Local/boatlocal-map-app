"use client";

// Custom date picker for the guest booking sheet (product owner rejected
// native `<input type="date">` — the picker must match the guest design
// system on every platform, not the OS widget).
//
// Deliberately an INLINE-expanding calendar, not a portal/popover: it lives
// inside BoatBookingPicker's bottom sheet, and expanding in-flow means it
// can never fight the sheet's stacking or scroll context — the sheet simply
// grows to fit the panel.
//
// All date math is done in local time via `new Date(y, m, d)` construction
// (which normalizes overflow safely across month ends and DST) — never via
// ISO-string parsing, which would be UTC midnight and can shift a day in
// timezones west of UTC.

import { useId, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { BORDER, BRAND_TINT, INK, MUTED, SECONDARY, SHADOW_CARD } from "@/lib/guestTheme";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface DatePickerFieldProps {
  /** Selected date as `YYYY-MM-DD` (the exact shape BoatBookingPicker
   * stores and buildBookingUrl expects), or null when unset. */
  value: string | null;
  onChange: (isoDate: string) => void;
  /** Earliest selectable date, `YYYY-MM-DD`. Days before max(min, today)
   * are disabled either way — the past is never selectable. */
  min?: string;
  /** Forwarded to the trigger button so an external <label htmlFor> keeps
   * working exactly as it did with the native input. */
  id?: string;
}

/** How far ahead the calendar can navigate, in months from today. */
const MAX_MONTHS_AHEAD = 18;

/**
 * Month/weekday names come from the guest's dictionary (useI18n's
 * `datePicker` group) — the tables that used to be hardcoded here in
 * English. Only the DISPLAY changes with locale: the `YYYY-MM-DD` value
 * contract below is byte-identical in every language.
 */
type DatePickerStrings = Dictionary["datePicker"];

/** Local-time `YYYY-MM-DD` — kept in lockstep with
 * boatBookingHandoff.ts's formatBookingDate. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` → local Date at midnight; null if malformed. */
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Months since year 0 — lets month comparisons ignore day-of-month. */
function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

/** Trigger label, e.g. "Sun 30 Aug 2026". Hand-built from the dictionary's
 * own tables (not toLocaleDateString) so it can't vary with device locale
 * or ICU version — only with the app's own selected locale. */
function formatTriggerLabel(date: Date, dp: DatePickerStrings): string {
  return `${dp.weekdayNamesShort[date.getDay()]} ${date.getDate()} ${
    dp.monthNamesShort[date.getMonth()]
  } ${date.getFullYear()}`;
}

/** Full accessible name, e.g. "Sunday 30 August 2026". */
function formatDayAriaLabel(date: Date, dp: DatePickerStrings): string {
  return `${dp.weekdayNames[date.getDay()]} ${date.getDate()} ${dp.monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

const navButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: `1px solid ${BORDER}`,
  background: "#FFFFFF",
  color: INK,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};

export function DatePickerField({ value, onChange, min, id }: DatePickerFieldProps) {
  const panelId = useId();
  const { t } = useI18n();
  const dp = t.datePicker;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parsedMin = min ? parseIsoDate(min) : null;
  // The past is never selectable, whatever `min` says.
  const minDate = parsedMin && parsedMin.getTime() > today.getTime() ? parsedMin : today;
  const minMonth = monthIndex(minDate.getFullYear(), minDate.getMonth());
  const maxMonth = monthIndex(today.getFullYear(), today.getMonth()) + MAX_MONTHS_AHEAD;

  const selected = value ? parseIsoDate(value) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = selected ?? minDate;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  function toggleOpen() {
    if (!open) {
      // Re-anchor the view on the selection (or the earliest bookable
      // month) every time the panel opens, so it never opens onto some
      // far-flung month left over from a previous browse.
      const base = selected ?? minDate;
      setView({ year: base.getFullYear(), month: base.getMonth() });
    }
    setOpen((o) => !o);
  }

  function moveMonth(delta: number) {
    setView((v) => {
      const mi = monthIndex(v.year, v.month) + delta;
      const clamped = Math.min(maxMonth, Math.max(minMonth, mi));
      return { year: Math.floor(clamped / 12), month: ((clamped % 12) + 12) % 12 };
    });
  }

  const viewMonthIndex = monthIndex(view.year, view.month);
  const canGoPrev = viewMonthIndex > minMonth;
  const canGoNext = viewMonthIndex < maxMonth;

  // Monday-first offset of the 1st: getDay() is Sunday-first, so rotate.
  const leadingBlanks = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  // Always 42 cells (6 weeks) so the panel height never jumps month to month.
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(view.year, view.month, i - leadingBlanks + 1);
    return date.getMonth() === view.month ? date : null;
  });

  const selectedIso = selected ? toIsoDate(selected) : null;
  const todayIso = toIsoDate(today);

  return (
    <div style={{ fontFamily: bodyFontFamily }}>
      <button
        type="button"
        id={id}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: `1px solid ${open ? "var(--brand-primary)" : BORDER}`,
          background: "#FFFFFF",
          padding: "0 12px",
          fontSize: 15,
          fontFamily: bodyFontFamily,
          color: selected ? INK : MUTED,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <span>{selected ? formatTriggerLabel(selected, dp) : dp.pickDate}</span>
        <CalendarDays size={17} color={MUTED} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          style={{
            marginTop: 8,
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: 12,
            boxShadow: SHADOW_CARD,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              disabled={!canGoPrev}
              aria-label={dp.prevMonth}
              style={{ ...navButtonStyle, opacity: canGoPrev ? 1 : 0.4 }}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span
              style={{
                fontFamily: displayFontFamily,
                fontSize: 15,
                fontWeight: 700,
                color: INK,
              }}
            >
              {dp.monthNames[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              disabled={!canGoNext}
              aria-label={dp.nextMonth}
              style={{ ...navButtonStyle, opacity: canGoNext ? 1 : 0.4 }}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>

          <div
            aria-hidden="true"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              marginBottom: 4,
            }}
          >
            {dp.weekdayHeader.map((day) => (
              <span
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: MUTED,
                  padding: "4px 0",
                }}
              >
                {day}
              </span>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              rowGap: 2,
            }}
          >
            {cells.map((date, i) => {
              if (!date) {
                // Outside the current month — blank, but still 40px tall so
                // every month renders the same stable 6-row grid.
                return <span key={i} aria-hidden="true" style={{ height: 40 }} />;
              }
              const iso = toIsoDate(date);
              const isSelected = iso === selectedIso;
              const isToday = iso === todayIso;
              const isDisabled = date.getTime() < minDate.getTime();
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isDisabled}
                  aria-label={formatDayAriaLabel(date, dp)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  style={{
                    height: 40,
                    width: "100%",
                    maxWidth: 40,
                    margin: "0 auto",
                    borderRadius: "50%",
                    border: 0,
                    padding: 0,
                    fontSize: 14,
                    fontWeight: isSelected || isToday ? 600 : 500,
                    fontFamily: bodyFontFamily,
                    background: isSelected
                      ? "var(--brand-primary)"
                      : isToday
                        ? BRAND_TINT
                        : "transparent",
                    color: isSelected ? "#FFFFFF" : isDisabled ? MUTED : INK,
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? "default" : "pointer",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected) {
                      e.currentTarget.style.background = isToday ? BRAND_TINT : SECONDARY;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isToday ? BRAND_TINT : "transparent";
                    }
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePickerField;
