"use client";

// Add / edit form for one boat tour (PRD §8.2, admin-only). This is the
// ONLY place a boat tour's own fields can be created or edited — Studio's
// Boat tours tab only toggles/reorders which tours a company features.
//
// Manual lng/lat entry only — no Google Places autocomplete (house rule),
// same convention as Studio's RecommendationForm.
//
// "Price & duration" edits BoatTourRecord.meta directly — see
// src/lib/admin/boatTourForm.ts's module comment for why there is no
// separate structured "price" column: meta is already the one guest-facing
// free-text field ("90 min · €28 pp · drinks incl.") that bundles duration,
// price and extras, and editing it here is what "changes propagate
// instantly" (PRD §8.2) actually means for it.

import { useActionState, useEffect, useState } from "react";

import PortalSelect from "@/components/PortalSelect";
import type { BoatTourRecord } from "@/lib/data/types";
import {
  saveBoatTourAction,
  type BoatTourFormState,
} from "@/lib/admin/boatTourActions";
import { NOTE_MAX_LENGTH } from "@/lib/admin/boatTourForm";
import AdminBoatPhotosField from "./AdminBoatPhotosField";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "hidden", label: "Hidden" },
];

const initialState: BoatTourFormState = {};

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]";
const labelClass = "block text-sm font-medium text-[var(--admin-ink)]";

export interface BoatTourFormProps {
  /** Omit (or pass null) to add a new tour. */
  tour?: BoatTourRecord | null;
  /** Next free catalog position, pre-filled only when adding a new tour. */
  suggestedPosition?: number;
  onDone: () => void;
  onCancel: () => void;
}

export default function BoatTourForm({
  tour,
  suggestedPosition,
  onDone,
  onCancel,
}: BoatTourFormProps) {
  const [state, formAction, pending] = useActionState(saveBoatTourAction, initialState);
  const [noteLength, setNoteLength] = useState(tour?.note.length ?? 0);

  // useActionState re-renders this component with the new state as soon as
  // the action resolves, so this fires exactly once per successful submit.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {tour ? <input type="hidden" name="id" value={tour.id} /> : null}

      <label className={labelClass}>
        Tour name
        <input
          name="name"
          required
          defaultValue={tour?.name}
          placeholder="Sunset Canal Cruise"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Departure point / area
        <input
          name="area"
          required
          defaultValue={tour?.area}
          placeholder="Central Station"
          className={inputClass}
        />
      </label>

      <div>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Longitude
            <input
              name="lng"
              type="number"
              step="any"
              required
              defaultValue={tour?.lng}
              placeholder="4.9003"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Latitude
            <input
              name="lat"
              type="number"
              step="any"
              required
              defaultValue={tour?.lat}
              placeholder="52.3791"
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
          No address lookup — drop a pin in your map app of choice, then copy its
          coordinates here.
        </p>
      </div>

      <label className={labelClass}>
        Price &amp; duration
        <input
          name="meta"
          required
          defaultValue={tour?.meta}
          placeholder="90 min · €28 pp · drinks incl."
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-[var(--admin-ink-soft)]">
          Free text, shown to guests exactly as written — the one place price,
          duration and any extras live.
        </span>
      </label>

      <label className={labelClass}>
        Description
        <textarea
          name="note"
          required
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={tour?.note}
          onChange={(e) => setNoteLength(e.target.value.length)}
          placeholder="What makes this tour worth booking."
          className={inputClass}
        />
        <span className="mt-1 block text-right text-xs text-[var(--admin-ink-soft)]">
          {noteLength}/{NOTE_MAX_LENGTH}
        </span>
      </label>

      <label className={labelClass}>
        Booking URL
        <input
          name="bookingUrl"
          type="url"
          required
          defaultValue={tour?.bookingUrl}
          placeholder="https://boatlocal.nl/tours/sunset-canal-cruise"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-[var(--admin-ink-soft)]">
          The tour&rsquo;s real boatlocal.nl booking page. A guest&rsquo;s
          actual &ldquo;Book&rdquo; tap appends tracking params (date, guests,
          campaign, etc.) onto this exact URL — it&rsquo;s the real redirect
          target, not just a reference link.
        </span>
      </label>

      <AdminBoatPhotosField initialPhotos={tour?.photos ?? []} />

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClass}>
          Position
          <input
            name="position"
            type="number"
            min={1}
            step={1}
            defaultValue={tour?.position ?? suggestedPosition}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-[var(--admin-ink-soft)]">
            Catalog order. Also adjustable with the &uarr;/&darr; controls in the
            table.
          </span>
        </label>

        <div>
          <label htmlFor="tour-status" className={labelClass}>
            Status
          </label>
          <PortalSelect
            id="tour-status"
            name="status"
            defaultValue={tour?.status ?? "active"}
            options={STATUS_OPTIONS}
            className="mt-1"
          />
          <span className="mt-1 block text-xs text-[var(--admin-ink-soft)]">
            Hidden tours can&rsquo;t be featured by any company.
          </span>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--admin-accent-strong)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
