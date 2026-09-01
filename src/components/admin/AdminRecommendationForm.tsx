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
// PortalSelect + AdminBoatPhotosField, useActionState, primitives.tsx
// classes) rather than on Studio's RecommendationForm, matching the task's
// "an admin-owned equivalent, not a Studio import" instruction. There is no
// guide selector here at all — an admin-curated recommendation is always
// ownerType "admin", guideId null, scoped to whichever one company the
// caller (AdminRecommendationsManager, bound to the company detail page) is
// currently showing.

import { useActionState, useEffect, useState } from "react";

import AddressField from "@/components/AddressField";
import PortalSelect from "@/components/PortalSelect";
import PortalToggle from "@/components/PortalToggle";
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
  // overwrite it by hand afterward" behaviour as `area` above. `category`
  // uses a remount key rather than an onChange-driven value because
  // PortalSelect only takes `defaultValue` (see its own header comment on
  // why — it's a shared component many other forms use uncontrolled);
  // bumping the key forces it to reinitialize with the new defaultValue.
  const [name, setName] = useState(recommendation?.name ?? "");
  const [hours, setHours] = useState(recommendation?.hours ?? "");
  // Typed as plain string (not CategoryId) so it can hold whatever
  // PortalSelect's onValueChange or a Google category guess hands back —
  // parseAdminRecommendationForm on the server is what actually validates
  // this is a real CategoryId before it's ever persisted.
  const [category, setCategory] = useState<string>(
    recommendation?.category ?? ADMIN_RECOMMENDATION_CATEGORIES[0]?.id ?? "",
  );
  const [categoryKey, setCategoryKey] = useState(0);
  const [addressApplyKey, setAddressApplyKey] = useState(0);
  const [addressApplyPick, setAddressApplyPick] = useState<{
    address: string;
    area?: string;
    lng: number;
    lat: number;
  } | null>(null);
  const [photosInjectKey, setPhotosInjectKey] = useState(0);
  const [photosInject, setPhotosInject] = useState<string[]>([]);

  function applyGooglePlace(details: PlaceDetails) {
    if (details.name) setName(details.name);
    if (details.hours) setHours(details.hours);
    setArea((current) => current.trim() || details.area);
    if (details.suggestedCategory) {
      setCategory(details.suggestedCategory);
      setCategoryKey((k) => k + 1);
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
          <label htmlFor="admin-recommendation-category" className={labelClass}>
            Category
          </label>
          <PortalSelect
            key={categoryKey}
            id="admin-recommendation-category"
            name="category"
            defaultValue={category}
            onValueChange={setCategory}
            options={ADMIN_RECOMMENDATION_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
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
