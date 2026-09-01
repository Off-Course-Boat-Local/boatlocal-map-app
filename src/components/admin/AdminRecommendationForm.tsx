"use client";

// Add / edit form for one company's admin-curated recommendation (the new
// "Admin recommendations for {company}" section on the company detail
// page). This is the ONLY place one of these rows' own fields can be
// created or edited — see src/lib/admin/adminRecommendationForm.ts's header
// for why this is its own module rather than importing Studio's
// RecommendationForm, and src/lib/data/types.ts's RecommendationOwnerType
// doc comment for the security model these rows exist under (never visible
// or editable from that company's own Studio, guest-visible exactly like
// any other recommendation).
//
// Modelled on src/components/admin/BoatTourForm.tsx's structure (this is
// Admin's own form convention, not Studio's — same shared AddressField +
// AdminBoatPhotosField, useActionState, primitives.tsx classes) rather than
// on Studio's RecommendationForm, matching the task's "an admin-owned
// equivalent, not a Studio import" instruction. There is no guide selector
// here at all — an admin-curated recommendation is always ownerType
// "admin", guideId null, scoped to whichever one company the caller
// (AdminRecommendationsManager, bound to the company detail page) is
// currently showing.
//
// CATEGORY is a checkbox group, not a <select>: a place can genuinely be
// more than one thing — see
// supabase/migrations/20260901120000_recommendations_multi_category.sql's
// header comment. The order checked = the stored array order, and
// array[0] is always the "primary" category used for the pin's colour/icon
// on the guest map (src/components/map/MapPins.tsx).

import { useActionState, useEffect, useState } from "react";

import AddressField from "@/components/AddressField";
import PortalToggle from "@/components/PortalToggle";
import type { CategoryId } from "@/lib/types";
import type { RecommendationRecord } from "@/lib/data/types";
import type { PlaceDetails } from "@/lib/admin/googlePlaces";
import {
  saveAdminRecommendationAction,
  type AdminRecommendationFormState,
} from "@/lib/admin/adminRecommendationActions";
import { ADMIN_RECOMMENDATION_CATEGORIES, NOTE_MAX_LENGTH } from "@/lib/admin/adminRecommendationForm";
import { FIELD_CLASS, FIELD_LABEL_CLASS, GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "./primitives";
import AdminBoatPhotosField from "./AdminBoatPhotosField";
import GooglePlaceSearchField from "./GooglePlaceSearchField";

const initialState: AdminRecommendationFormState = {};

const inputClass = `mt-1.5 ${FIELD_CLASS}`;
const labelClass = FIELD_LABEL_CLASS;

export interface AdminRecommendationFormProps {
  companyId: string;
  /** Omit (or pass null) to add a new recommendation. */
  recommendation?: RecommendationRecord | null;
  onDone: () => void;
  onCancel: () => void;
}

export default function AdminRecommendationForm({
  companyId,
  recommendation,
  onDone,
  onCancel,
}: AdminRecommendationFormProps) {
  const boundSaveAction = saveAdminRecommendationAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState(boundSaveAction, initialState);
  const [noteLength, setNoteLength] = useState(recommendation?.note.length ?? 0);
  const [visible, setVisible] = useState(recommendation?.visible ?? true);
  // Controlled so a picked address suggestion can fill it in — an admin can
  // still overwrite whatever the geocoder guessed.
  const [area, setArea] = useState(recommendation?.area ?? "");

  // Everything below is controlled ONLY so a Google Places pick
  // (GooglePlaceSearchField) can fill it in — same "an admin can still
  // overwrite it by hand afterward" behaviour as `area` above.
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
      // Merge, don't replace — an admin may have already hand-picked some.
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
  }

  // useActionState re-renders this component with the new state as soon as
  // the action resolves, so this fires exactly once per successful submit.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {recommendation ? <input type="hidden" name="id" value={recommendation.id} /> : null}

      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3.5 py-3">
        <PortalToggle
          name="visible"
          checked={visible}
          onChange={setVisible}
          label={visible ? "Live on this company's guest map" : "Hidden from guests"}
          hint={
            visible
              ? "Guests see this on the map/list right now — never in this company's own Studio."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className={labelClass}>Categories</p>
          <p className="mt-0.5 text-xs text-[var(--admin-ink-soft)]">
            Check every one that fits — the first one you check sets the pin colour.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ADMIN_RECOMMENDATION_CATEGORIES.map((c) => {
              const checked = categories.includes(c.id);
              const order = checked ? categories.indexOf(c.id) + 1 : null;
              return (
                <label
                  key={c.id}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    checked
                      ? "border-[var(--admin-accent)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]"
                      : "border-[var(--admin-border)] text-[var(--admin-ink-soft)] hover:bg-[var(--admin-bg)]"
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
                    <span className="flex size-4 items-center justify-center rounded-full bg-[var(--admin-accent)] text-[0.625rem] font-bold text-white">
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
        geocodeEndpoint="/api/admin/geocode"
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
        <span className="mt-1 block text-xs text-[var(--admin-ink-soft)]">
          Free text — whatever you&apos;d tell a guest. Google&apos;s hours come in verbatim —
          trim it down to what a guest actually needs.
        </span>
      </label>

      <label className={labelClass}>
        Note
        <textarea
          name="note"
          required
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={recommendation?.note}
          onChange={(e) => setNoteLength(e.target.value.length)}
          placeholder="Why a guest should go here — this is the whole endorsement, not a rating."
          className={inputClass}
        />
        <span className="mt-1 block text-right text-xs text-[var(--admin-ink-soft)]">
          {noteLength}/{NOTE_MAX_LENGTH}
        </span>
      </label>

      <AdminBoatPhotosField
        initialPhotos={recommendation?.photos ?? []}
        injectPhotos={photosInject}
        injectKey={photosInjectKey}
      />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
