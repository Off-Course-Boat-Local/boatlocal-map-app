// Reads a File into a data: URL, for the Branding form's logo upload.
//
// There is no Supabase Storage (or any storage) yet — see the "no real
// Supabase project" project rule — so a guide-uploaded logo has nowhere
// real to go. A data URL is a deliberate placeholder: it round-trips
// through the same `logoUrl: string | null` column CompanyRecord already
// has, so nothing about the data shape changes when a real upload exists —
// only this function's implementation does, becoming an upload to Storage
// that returns a public URL instead of a base64 blob.

/** PNG and SVG only, per PRD §7.2 ("Logo upload (PNG/SVG)"). */
export const ACCEPTED_LOGO_MIME_TYPES = ["image/png", "image/svg+xml"];

/** Generous but not unbounded — a data URL this large is already an odd choice of logo asset, and the fake store keeps everything in memory. */
export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export class InvalidLogoFileError extends Error {}

/**
 * Validates type/size, then resolves to a `data:` URL. Rejects with
 * InvalidLogoFileError for a bad type or an oversized file, so callers can
 * show a friendly message rather than a generic upload failure.
 */
export function fileToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_MIME_TYPES.includes(file.type)) {
    return Promise.reject(new InvalidLogoFileError("Please choose a PNG or SVG file."));
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    return Promise.reject(new InvalidLogoFileError("Logo must be smaller than 2MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new InvalidLogoFileError("Could not read that file."));
      }
    };
    reader.onerror = () => reject(new InvalidLogoFileError("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
