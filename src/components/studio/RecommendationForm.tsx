"use client";

// Add / edit form for one place (PRD §7.4 company base list, §6.3 guide
// personal additions).
//
// LOCATION: the longitude/latitude number inputs are gone — a guide types
// an address or a venue name, picks a suggestion, and drags the pin to
// correct it (see ./AddressField.tsx, which still submits `lng`/`lat` as
// hidden fields, so nothing downstream changed).
//
// VISIBILITY sits at the TOP of the form, not buried at the bottom above
// the Save button — founder's call: "the toggle for making the
// recommendation active or not should be at the top... so they can quickly
// toggle it off or not." It is also a switch rather than a checkbox, and
// the same switch is repeated per-row in the table for the same reason.
//
// The category <select> deliberately excludes "boats": boat tours live in
// their own table and are managed from the Boat tours tab, never here (see
// RECOMMENDATION_CATEGORIES in ./recommendationForm.ts).

import { useActionState, useEffect, useState } from "react";

import PortalSelect from "@/components/PortalSelect";
import PortalToggle from "@/components/PortalToggle";
import type { RecommendationRecord } from "@/lib/data/types";
import {
  saveRecommendationAction,
  type RecommendationFormState,
} from "@/lib/studio/recommendationActions";
import { NOTE_MAX_LENGTH, RECOMMENDATION_CATEGORIES } from "@/lib/studio/recommendationForm";
import { GhostButton, PrimaryButton, inputClass, labelClass } from "./primitives";
import AddressField from "./AddressField";
import RecommendationPhotosField from "./RecommendationPhotosField";

const initialState: RecommendationFormState = {};

export interface RecommendationFormProps {
  /** Omit (or pass null) to add a new place. */
  recommendation?: RecommendationRecord | null;
  /** Called once the save action succeeds. */
  onDone: () => void;
  onCancel: () => void;
  /**
   * Defaults to saveRecommendationAction (Studio's own save path, gated on a
   * signed-in dev session). Admin's /admin/default-company page passes its
   * own admin-gated equivalent, bound to the flagged company's id
   * (src/lib/admin/defaultCompanyActions.ts) — same underlying
   * saveRecommendation() call, different session check and actor — so this
   * one form serves both surfaces without a second copy of the UI.
   */
  saveAction?: typeof saveRecommendationAction;
}

export default function RecommendationForm({
  recommendation,
  onDone,
  onCancel,
  saveAction = saveRecommendationAction,
}: RecommendationFormProps) {
  const [state, formAction, pending] = useActionState(saveAction, initialState);
  const [noteLength, setNoteLength] = useState(recommendation?.note.length ?? 0);
  const [visible, setVisible] = useState(recommendation?.visible ?? true);
  // Controlled so a picked address suggestion can fill it in — the guide can
  // still overwrite whatever the geocoder guessed.
  const [area, setArea] = useState(recommendation?.area ?? "");

  // useActionState re-renders this component with the new state as soon as
  // the action resolves, so this fires exactly once per successful submit.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {recommendation ? <input type="hidden" name="id" value={recommendation.id} /> : null}

      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] px-3.5 py-3">
        <PortalToggle
          name="visible"
          checked={visible}
          onChange={setVisible}
          label={visible ? "Live on the guest map" : "Hidden from guests"}
          hint={
            visible
              ? "Guests can see this place right now."
              : "Saved, but not shown to guests until you switch this back on."
          }
        />
      </div>

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
        <div>
          <label htmlFor="recommendation-category" className={labelClass}>
            Category
          </label>
          <PortalSelect
            id="recommendation-category"
            name="category"
            defaultValue={recommendation?.category ?? RECOMMENDATION_CATEGORIES[0]?.id ?? ""}
            options={RECOMMENDATION_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            className="mt-1"
          />
        </div>

        <label className={labelClass}>
          Area / neighbourhood
          <input
            name="area"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Centrum"
            className={inputClass}
          />
        </label>
      </div>

      <AddressField
        initialAddress={recommendation?.address}
        initialLng={recommendation?.lng}
        initialLat={recommendation?.lat}
        onAreaSuggested={(suggested) => setArea((current) => current.trim() || suggested)}
      />

      <label className={labelClass}>
        Opening hours
        <input
          name="hours"
          defaultValue={recommendation?.hours}
          placeholder="Tue–Sun 11:00–18:00, closed Mondays"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-[var(--studio-ink-soft)]">
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
        <span className="mt-1 block text-right text-xs text-[var(--studio-ink-soft)]">
          {noteLength}/{NOTE_MAX_LENGTH}
        </span>
      </label>

      <RecommendationPhotosField initialPhotos={recommendation?.photos ?? []} />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </form>
  );
}
