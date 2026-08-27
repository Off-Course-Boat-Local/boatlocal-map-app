"use client";

// Multiple-photo picker for the Admin "Add / edit boat tour" form.
// Features clickable button triggers with clear pointer cursor, photo gallery
// preview, remove buttons, and drag-and-drop or file picker support.

import { useId, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

import PhotoGallery from "@/components/map/PhotoGallery";
import { MAX_PHOTOS, PHOTO_NUDGE_THRESHOLD } from "@/lib/admin/boatTourForm";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB

export interface AdminBoatPhotosFieldProps {
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

export default function AdminBoatPhotosField({
  initialPhotos = [],
}: AdminBoatPhotosFieldProps) {
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
      setNotice(`Only added ${files.length} — the limit is ${MAX_PHOTOS} photos per tour.`);
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
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--admin-ink)]">
          Photos
        </label>
        <span className="text-xs text-[var(--admin-ink-soft)]">
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
          ? "Tours with 3+ photos get more bookings — add a couple more."
          : "Nice — this tour has 3+ photos."}
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
                  className="h-14 w-14 rounded-lg border border-[var(--admin-border)] object-cover shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-transform hover:scale-110 active:scale-95"
                >
                  <X className="size-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Custom styled clickable file uploader with pointer cursor */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--admin-accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:opacity-90 active:scale-98"
        >
          <Upload className="size-3.5" strokeWidth={2.25} />
          Choose Photos
        </button>
        <span className="text-xs text-[var(--admin-ink-soft)]">
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
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
