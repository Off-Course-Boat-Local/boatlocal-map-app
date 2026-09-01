"use client";

// Add / edit form for one place (PRD §7.4 company base list, §6.3 guide
// personal additions).
//
// LOCATION: the longitude/latitude number inputs are gone — a guide types
// an address or a venue name, picks a suggestion, and drags the pin to
// correct it (see ../AddressField.tsx — promoted to a shared, cross-portal
// component once Admin's BoatTourForm needed the same UX — which still
// submits `lng`/`lat` as hidden fields, so nothing downstream changed).
//
// VISIBILITY sits at the TOP of the form, not buried at the bottom above
// the Save button — founder's call: "the toggle for making the
// recommendation active or not should be at the top... so they can quickly
// toggle it off or not." It is also a switch rather than a checkbox, and
// the same switch is repeated per-row in the table for the same reason.
//
// CATEGORY is a checkbox group, not a <select>: a place can genuinely be
// more than one thing (a cafe that's also a breakfast spot) — see
// supabase/migrations/20260901120000_recommendations_multi_category.sql's
// header comment. The order checked = the stored array order, and
// array[0] is always the "primary" category used for the pin's colour/icon
// on the guest map (src/components/map/MapPins.tsx) — so the FIRST box a
// guide/company checks is the one that decides the pin's look, same as
// Admin's equivalent form. It deliberately excludes "boats": boat tours
// live in their own table and are managed from the Boat tours tab, never
// here (see RECOMMENDATION_CATEGORIES in ./recommendationForm.ts).
//
// GOOGLE PLACES enrichment (search Google Maps for the typed name, pull
// hours/category-guesses/up to 8 photos) is available here too, same as
// Admin's recommendation form — see recommendationForm.ts's own "NOTE ON
// GOOGLE PLACES" for the scoped house-rule override this is part of.

import { useActionState, useEffect, useState } from "react";

import PortalToggle from "@/components/PortalToggle";
import RatingBadge from "@/components/map/RatingBadge";
import type { CategoryId } from "@/lib/types";
import type { RecommendationRecord } from "@/lib/data/types";
import type { PlaceDetails } from "@/lib/admin/googlePlaces";
import {
  saveRecommendationAction,
  type RecommendationFormState,
} from "@/lib/studio/recommendationActions";
import { NOTE_MAX_LENGTH, RECOMMENDATION_CATEGORIES } from "@/lib/studio/recommendationForm";
import { GhostButton, PrimaryButton, inputClass, labelClass } from "./primitives";
import AddressField from "@/components/AddressField";
import RecommendationPhotosField from "./RecommendationPhotosField";
import GooglePlaceSearchField from "./GooglePlaceSearchField";

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

  // Everything below is controlled ONLY so a Google Places pick
  // (GooglePlaceSearchField) can fill it in — same "still overwritable by
  // hand afterward" behaviour as `area` above.
  const [name, setName] = useState(recommendation?.name ?? "");
  const [hours, setHours] = useState(recommendation?.hours ?? "");
  const [categories, setCategories] = useState<CategoryId[]>(
    recommendation?.categories ?? [],
  );
  const [addressApplyKey, setAddressApplyKey] = useState(0);
  const [addressApplyPick, setAddressApplyPick] = useState<{
    address: string;
    area?: string;
    lng: number;
    lat: number;
  } | null>(null);
  const [photosInjectKey, setPhotosInjectKey] = useState(0);
  const [photosInject, setPhotosInject] = useState<string[]>([]);
  const [googleRating, setGoogleRating] = useState<number | null>(
    recommendation?.googleRating ?? null,
  );
  const [googleReviewCount, setGoogleReviewCount] = useState<number | null>(
    recommendation?.googleReviewCount ?? null,
  );

  function toggleCategory(id: CategoryId) {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function applyGooglePlace(details: PlaceDetails) {
    if (details.name) setName(details.name);
    if (details.hours) setHours(details.hours);
    setArea((current) => current.trim() || details.area);
    if (details.suggestedCategories.length > 0) {
      // Merge, don't replace — a person may have already hand-picked some.
      setCategories((prev) => {
        const merged = [...prev];
        for (const c of details.suggestedCategories) {
          if (!merged.includes(c as CategoryId)) merged.push(c as CategoryId);
        }
        return merged;
      });
    }
    if (Number.isFinite(details.lat) && Number.isFinite(details.lng)) {
      setAddressApplyPick({
        address: details.address || details.name,
        area: details.area,
        lat: details.lat,
        lng: details.lng,
      });
      setAddressApplyKey((k) => k + 1);
    }
    if (details.photos.length > 0) {
      setPhotosInject(details.photos);
      setPhotosInjectKey((k) => k + 1);
    }
    setGoogleRating(details.rating);
    setGoogleReviewCount(details.reviewCount);
  }

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Café de Jaren"
          className={inputClass}
        />
      </label>

      <GooglePlaceSearchField query={name} onApply={applyGooglePlace} />

      {googleRating != null ? (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--studio-bg)] px-3 py-2">
          <RatingBadge rating={googleRating} reviewCount={googleReviewCount} size={14} />
          <span className="text-xs text-[var(--studio-ink-soft)]">
            from Google — shown to guests alongside your note
          </span>
        </div>
      ) : null}
      <input type="hidden" name="googleRating" value={googleRating ?? ""} />
      <input type="hidden" name="googleReviewCount" value={googleReviewCount ?? ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className={labelClass}>Categories</p>
          <p className="mt-0.5 text-xs text-[var(--studio-ink-soft)]">
            Check every one that fits — the first one you check sets the pin colour.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECOMMENDATION_CATEGORIES.map((c) => {
              const checked = categories.includes(c.id);
              const order = checked ? categories.indexOf(c.id) + 1 : null;
              return (
                <label
                  key={c.id}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    checked
                      ? "border-[var(--studio-accent)] bg-[var(--studio-accent)]/10 text-[var(--studio-accent)]"
                      : "border-[var(--studio-border)] text-[var(--studio-ink-soft)] hover:bg-[var(--studio-bg)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={c.id}
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                    className="sr-only"
                  />
                  {order ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-[var(--studio-accent)] text-[0.625rem] font-bold text-white">
                      {order}
                    </span>
                  ) : null}
                  {c.label}
                </label>
              );
            })}
          </div>
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
        applyPick={addressApplyPick}
        applyKey={addressApplyKey}
      />

      <label className={labelClass}>
        Opening hours
        <input
          name="hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Tue–Sun 11:00–18:00, closed Mondays"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-[var(--studio-ink-soft)]">
          Free text — whatever you&apos;d tell a guest. Google&apos;s hours come in verbatim —
          trim it down to what a guest actually needs.
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

      <RecommendationPhotosField
        initialPhotos={recommendation?.photos ?? []}
        injectPhotos={photosInject}
        injectKey={photosInjectKey}
      />

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
