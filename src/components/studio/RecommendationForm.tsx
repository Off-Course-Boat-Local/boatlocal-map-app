"use client";

// Add / edit form for one place (PRD §7.4 company base list, §6.3 guide
// personal additions). Manual entry only — no Google Places autocomplete
// (house rule) — so address is free text and location is entered as plain
// longitude/latitude, with a hint for where to find those numbers.
//
// The category <select> deliberately excludes "boats": boat tours live in
// their own table and are managed from the Boat tours tab, never here (see
// RECOMMENDATION_CATEGORIES in ./recommendationForm.ts).

import { useActionState, useEffect, useState } from "react";

import type { RecommendationRecord } from "@/lib/data/types";
import {
  saveRecommendationAction,
  type RecommendationFormState,
} from "@/lib/studio/recommendationActions";
import { NOTE_MAX_LENGTH, RECOMMENDATION_CATEGORIES } from "@/lib/studio/recommendationForm";
import RecommendationPhotosField from "./RecommendationPhotosField";

const initialState: RecommendationFormState = {};

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";
const labelClass = "block text-sm font-medium text-neutral-700";

export interface RecommendationFormProps {
  /** Omit (or pass null) to add a new place. */
  recommendation?: RecommendationRecord | null;
  /** Called once the save action succeeds. */
  onDone: () => void;
  onCancel: () => void;
}

export default function RecommendationForm({
  recommendation,
  onDone,
  onCancel,
}: RecommendationFormProps) {
  const [state, formAction, pending] = useActionState(saveRecommendationAction, initialState);
  const [noteLength, setNoteLength] = useState(recommendation?.note.length ?? 0);

  // useActionState re-renders this component with the new state as soon as
  // the action resolves, so this fires exactly once per successful submit.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {recommendation ? <input type="hidden" name="id" value={recommendation.id} /> : null}

      <label className={labelClass}>
        Name
        <input
          name="name"
          required
          defaultValue={recommendation?.name}
          placeholder="Café de Jaren"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Category
          <select
            name="category"
            required
            defaultValue={recommendation?.category ?? RECOMMENDATION_CATEGORIES[0]?.id}
            className={inputClass}
          >
            {RECOMMENDATION_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Area / neighbourhood
          <input
            name="area"
            required
            defaultValue={recommendation?.area}
            placeholder="Centrum"
            className={inputClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        Address
        <input
          name="address"
          required
          defaultValue={recommendation?.address}
          placeholder="Nieuwe Doelenstraat 20"
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
              defaultValue={recommendation?.lng}
              placeholder="4.8965"
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
              defaultValue={recommendation?.lat}
              placeholder="52.3676"
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          No address lookup — drop a pin in your map app of choice, then copy its
          coordinates here.
        </p>
      </div>

      <label className={labelClass}>
        Opening hours
        <input
          name="hours"
          defaultValue={recommendation?.hours}
          placeholder="Tue–Sun 11:00–18:00, closed Mondays"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Free text — whatever you&apos;d tell a guest.
        </span>
      </label>

      <label className={labelClass}>
        Personal note
        <textarea
          name="note"
          required
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={recommendation?.note}
          onChange={(e) => setNoteLength(e.target.value.length)}
          placeholder="Why you'd send a guest here — this is the whole endorsement, not a rating."
          className={inputClass}
        />
        <span className="mt-1 block text-right text-xs text-neutral-400">
          {noteLength}/{NOTE_MAX_LENGTH}
        </span>
      </label>

      <RecommendationPhotosField initialPhotos={recommendation?.photos ?? []} />

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="visible"
          defaultChecked={recommendation?.visible ?? true}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Visible on the guest map
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
