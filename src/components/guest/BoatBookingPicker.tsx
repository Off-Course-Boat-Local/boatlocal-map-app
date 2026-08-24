"use client";

// The date + guest-count picker triggered by the Boats filter (PRD §5.5).
//
// The date field is the custom DatePickerField calendar (product owner
// rejected native `<input type="date">` — the picker must match the guest
// design system on every platform, not the OS widget). It stores the same
// `YYYY-MM-DD` string the native input did, so everything downstream is
// untouched. Setting trip details is entirely optional: closing this
// without saving, or booking with no date/guest count set, is a fully
// supported path (see src/lib/boatBookingHandoff.ts) — the picker exists to
// make booking faster when a guest already knows their plans, not to gate
// it.
//
// Visual language matches PlaceCard.tsx (same white card, same neutral
// chrome constants, same shadow) since this sheet sits in the same map
// overlay stack.

import { useId, useState, type CSSProperties } from "react";

import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatBookingDate, type BoatBookingSelection } from "@/lib/boatBookingHandoff";
import { DatePickerField } from "./DatePickerField";

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

export interface BoatBookingPickerProps {
  value: BoatBookingSelection;
  onChange: (next: BoatBookingSelection) => void;
  onClose: () => void;
  minGuests?: number;
  maxGuests?: number;
}

const stepperButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: `1px solid ${BORDER}`,
  background: "#FFFFFF",
  color: INK,
  fontSize: 18,
  lineHeight: "30px",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};

export function BoatBookingPicker({
  value,
  onChange,
  onClose,
  minGuests = 1,
  maxGuests = 12,
}: BoatBookingPickerProps) {
  const { t } = useI18n();
  const dateInputId = useId();
  const [date, setDate] = useState<string>(
    value.date ? formatBookingDate(value.date) : "",
  );
  const [guests, setGuests] = useState<number>(value.guests || 2);

  const today = formatBookingDate(new Date());

  function commit() {
    // Parsed as a local calendar date (not UTC midnight) so the date the
    // guest picked is the date that survives into formatBookingDate() —
    // `new Date("YYYY-MM-DD")` alone parses as UTC midnight, which can shift
    // a day backwards in a timezone west of UTC.
    onChange({
      date: date ? new Date(`${date}T00:00:00`) : null,
      guests,
    });
    onClose();
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={t.booking.dialogLabel}
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 30,
        background: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        fontFamily: bodyFontFamily,
        color: INK,
        boxShadow:
          "0 18px 40px -12px rgba(16, 20, 28, 0.34), 0 4px 12px -4px rgba(16, 20, 28, 0.14)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <h2
          style={{
            margin: 0,
            fontFamily: displayFontFamily,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {t.booking.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          style={{
            border: 0,
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            padding: 4,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <p style={{ margin: "4px 0 14px", fontSize: 13, color: MUTED }}>
        {t.booking.body}
      </p>

      <label
        htmlFor={dateInputId}
        style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}
      >
        {t.booking.dateLabel}
      </label>
      <div style={{ marginBottom: 14 }}>
        <DatePickerField
          id={dateInputId}
          value={date || null}
          min={today}
          onChange={setDate}
        />
      </div>

      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
        {t.booking.guestsLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setGuests((g) => Math.max(minGuests, g - 1))}
          aria-label={t.booking.fewerGuests}
          disabled={guests <= minGuests}
          style={{ ...stepperButtonStyle, opacity: guests <= minGuests ? 0.4 : 1 }}
        >
          −
        </button>
        <span style={{ minWidth: 28, textAlign: "center", fontSize: 16, fontWeight: 600 }}>
          {guests}
        </span>
        <button
          type="button"
          onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
          aria-label={t.booking.moreGuests}
          disabled={guests >= maxGuests}
          style={{ ...stepperButtonStyle, opacity: guests >= maxGuests ? 0.4 : 1 }}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={commit}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: 0,
          background: "var(--brand-primary)",
          color: "#FFFFFF",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: bodyFontFamily,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {t.booking.save}
      </button>
    </section>
  );
}

export default BoatBookingPicker;
