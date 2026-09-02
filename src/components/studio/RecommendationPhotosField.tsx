"use client";

// Multiple-photo picker for the Studio "Add / edit place" form (also used,
// unmodified, by Admin's — see /api/recommendations/photos/upload's own
// header for why that route isn't nested under either portal).
//
// A picked file is uploaded via /api/recommendations/photos/upload
// (Supabase Storage, `recommendation-photos` bucket) and the resulting
// public URL is what gets pushed into state / submitted as an ordinary
// hidden form field (name="photos", one per photo) — RecommendationRow.
// photos is just string[], and the guest-facing PhotoGallery component
// already renders any URL, so nothing downstream needs to know a photo
// came from an upload vs. Google Places enrichment vs. anywhere else.
//
// NOT base64-in-the-row anymore (2026-09-02 fix): that used to mean every
// guest visiting /list or /saved downloaded the ENTIRE photo set for every
// recommendation as part of the page's own HTML payload on every single
// navigation — 15–28 MB per load. See scripts/migrate-photos-to-storage.mjs
// for the one-time migration of everything that predates this.
//
// ENFORCES:
//   - max 5 photos per place (silently drops any beyond that if multiple
//     files are picked at once, and warns the user).
//   - 4MB max per individual file (protects the database row and the
//     client-side render from huge uploads pre-Storage).
//   - non-image MIME types rejected.
//   - "3+ photos" nudge shown as a soft notice above the picker, matching
//     PRD §6.4's recommendations guidance.
//
// REVEALS A REMOVE BUTTON over each thumbnail, allowing re-ordering (delete +
// re-upload) and curation before submitting the form.

import { useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

import PhotoGallery from "@/components/map/PhotoGallery";
import { MAX_PHOTOS, PHOTO_NUDGE_THRESHOLD } from "@/lib/studio/recommendationForm";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB

export interface RecommendationPhotosFieldProps {
  initialPhotos?: string[];
  /**
   * Photos supplied from outside the file picker — e.g. Google Places
   * enrichment via GooglePlaceSearchField — merged in as data URLs exactly
   * like a file upload would be (same MAX_PHOTOS cap, same overflow
   * notice). Keyed on `injectKey` rather than the array itself so the
   * parent can pass a fresh array each render without this re-firing; only
   * an actual new batch (a bumped key) should be merged. Same pattern as
   * src/components/admin/AdminBoatPhotosField.tsx's `injectPhotos`.
   */
  injectPhotos?: string[];
  injectKey?: number;
}

/** Uploads one file to Storage and resolves its public URL, or null if the file is invalid or the upload failed — either way it's just dropped, same "don't fail the whole batch over one bad file" contract the old data-URL version had. */
async function uploadPhoto(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) return null;
  try {
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/recommendations/photos/upload", { method: "POST", body });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

export default function RecommendationPhotosField({
  initialPhotos = [],
  injectPhotos,
  injectKey,
}: RecommendationPhotosFieldProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [notice, setNotice] = useState<string | null>(null);
  // Uploads are a real network round-trip now (Storage, not an instant
  // client-side FileReader) — this disables the picker mid-upload so a
  // second click can't fire a race against the first batch, and gives the
  // button something to say while a guide is staring at a spinner-less gap.
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  // Tracks the last-applied `injectKey` so an external batch (Google Places
  // photos) is merged exactly once per bump, during render rather than in
  // an Effect — same pattern AdminBoatPhotosField's `injectKey` uses.
  const [appliedInjectKey, setAppliedInjectKey] = useState(injectKey);

  // Merges an externally-supplied batch (Google Places photos) the same way
  // handleFiles merges an upload: respects MAX_PHOTOS, surfaces the same
  // overflow notice.
  if (injectKey !== appliedInjectKey && injectPhotos && injectPhotos.length > 0) {
    setAppliedInjectKey(injectKey);
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const toAdd = injectPhotos.slice(0, room);
    if (injectPhotos.length > toAdd.length) {
      setNotice(`Only added ${toAdd.length} — the limit is ${MAX_PHOTOS} photos per place.`);
    } else {
      setNotice(null);
    }
    setPhotos((prev) => [...prev, ...toAdd]);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const files = Array.from(fileList).slice(0, room);
    const skippedForRoom = fileList.length - files.length;

    setUploading(true);
    const results = await Promise.all(files.map(uploadPhoto));
    setUploading(false);
    const good = results.filter((r): r is string => r !== null);
    const skippedForType = results.length - good.length;

    setPhotos((prev) => [...prev, ...good]);
    if (inputRef.current) inputRef.current.value = "";

    if (skippedForRoom > 0) {
      setNotice(`Only added ${files.length} — the limit is ${MAX_PHOTOS} photos per place.`);
    } else if (skippedForType > 0) {
      setNotice("Some files were skipped — only images under 4MB are supported, and uploads can fail on a slow connection.");
    } else {
      setNotice(null);
    }
  }

  function removeAt(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  const showNudge = photos.length < PHOTO_NUDGE_THRESHOLD;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--studio-ink)]">
          Photos
        </label>
        <span className="text-xs text-[var(--studio-ink-soft)]">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {/* Hidden inputs submitted with the form */}
      {photos.map((src, i) => (
        <input key={`${i}-${src.length}`} type="hidden" name="photos" value={src} />
      ))}

      <p
        role="status"
        className={
          showNudge
            ? "rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400"
            : "rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
        }
      >
        {showNudge
          ? "Places with 3+ photos get more attention — add a couple more."
          : "Nice — this place has 3+ photos."}
      </p>

      {photos.length > 0 ? (
        <div className="space-y-2.5">
          <PhotoGallery photos={photos} alt="Preview" aspectRatio="16 / 10" radius={10} />
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={`${i}-thumb`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1} of ${photos.length}`}
                  className="h-14 w-14 rounded-lg border border-[var(--studio-border)] object-cover shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-transform hover:scale-110 active:scale-95"
                >
                  <X className="size-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Custom styled clickable button with pointer cursor */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--studio-accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:opacity-90 active:scale-98 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="size-3.5" strokeWidth={2.25} />
          {uploading ? "Uploading…" : "Choose Photos"}
        </button>
        <span className="text-xs text-[var(--studio-ink-soft)]">
          PNG, JPG, WEBP up to 4MB each
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleFiles(e.target.files)}
        className="sr-only"
      />

      {notice ? (
        <p role="alert" className="text-xs text-red-600">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
