"use client";

// Multiple-photo picker for the Studio "Add / edit place" form.
//
// There is no Supabase Storage yet (see project rules), so uploads are read
// client-side into data: URLs and submitted as ordinary hidden form fields
// (name="photos", one per photo) — RecommendationRecord.photos is already
// just string[], and the guest-facing PhotoGallery component already
// renders any URL, data: or otherwise, so nothing downstream needs to know
// the difference. When real Storage exists, only handleFiles' body changes
// (upload -> get a public URL -> push that instead of the data: URL); the
// hidden-input wiring and the rest of the form stay identical.
//
// Reuses the guest-facing PhotoGallery component for the live preview
// (project rule: don't rebuild it) and surfaces the founder's explicit
// "3+ photos" nudge.

import { useId, useRef, useState } from "react";

import PhotoGallery from "@/components/map/PhotoGallery";
import { MAX_PHOTOS, PHOTO_NUDGE_THRESHOLD } from "@/lib/studio/recommendationForm";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // data: URLs are the only "storage" pre-Supabase — keep them small.

export interface RecommendationPhotosFieldProps {
  initialPhotos?: string[];
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export default function RecommendationPhotosField({
  initialPhotos = [],
}: RecommendationPhotosFieldProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const files = Array.from(fileList).slice(0, room);
    const skippedForRoom = fileList.length - files.length;

    const results = await Promise.all(files.map(readAsDataUrl));
    const good = results.filter((r): r is string => r !== null);
    const skippedForType = results.length - good.length;

    setPhotos((prev) => [...prev, ...good]);
    if (inputRef.current) inputRef.current.value = "";

    if (skippedForRoom > 0) {
      setNotice(`Only added ${files.length} — the limit is ${MAX_PHOTOS} photos per listing.`);
    } else if (skippedForType > 0) {
      setNotice("Some files were skipped — only images under 4MB are supported.");
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
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
          Photos
        </label>
        <span className="text-xs text-neutral-500">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {/* Submitted as part of the surrounding <form> even though this field
          itself renders no visible <input name="photos">. */}
      {photos.map((src, i) => (
        <input key={`${i}-${src.length}`} type="hidden" name="photos" value={src} />
      ))}

      <p
        role="status"
        className={
          showNudge
            ? "rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            : "rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
        }
      >
        {showNudge
          ? "Listings with 3+ photos get more saves — add a couple more."
          : "Nice — this listing has 3+ photos."}
      </p>

      {photos.length > 0 ? (
        <div className="space-y-2">
          <PhotoGallery photos={photos} alt="Preview" aspectRatio="16 / 10" radius={10} />
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={`${i}-thumb`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1} of ${photos.length}`}
                  className="h-14 w-14 rounded-md border border-neutral-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold leading-none text-white"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleFiles(e.target.files)}
        className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
      />
      {notice ? (
        <p role="alert" className="text-xs text-red-600">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
