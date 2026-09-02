// One-time data migration: recommendations.photos moves from full base64
// data URIs embedded inline in the row (the ORIGINAL, pre-Storage design —
// see src/components/studio/RecommendationPhotosField.tsx's old header
// comment) to plain https URLs pointing at the `recommendation-photos`
// Supabase Storage bucket.
//
// WHY: a guest visiting /list or /saved was downloading the ENTIRE photo
// set for every recommendation as part of the page's own HTML/RSC payload
// on every single navigation — 15–28 MB per page load, un-cacheable across
// navigations because the bytes are baked into the markup itself, not
// separate image requests. Founder report, 2026-09-02: "loading is very
// very slow on the domain... thats problematic." Moving to Storage URLs
// makes each photo a normal, independently-cacheable image request, and
// shrinks the page payload back to actual page content.
//
// Idempotent: skips any photo that's already an https URL (so this is safe
// to re-run, e.g. after a future batch of places was added the old way).
//
// Usage: node --env-file=.env.local scripts/migrate-photos-to-storage.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "recommendation-photos";

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, buffer: Buffer.from(base64, "base64") };
}

async function main() {
  const { data: rows, error } = await admin
    .from("recommendations")
    .select("id, company_id, name, photos");
  if (error) throw error;

  let migratedPhotos = 0;
  let skippedAlreadyUrl = 0;
  let unparseable = 0;
  let rowsUpdated = 0;
  let bytesBefore = 0;

  for (const row of rows) {
    if (!row.photos || row.photos.length === 0) continue;

    let changed = false;
    const nextPhotos = [];

    for (let i = 0; i < row.photos.length; i++) {
      const original = row.photos[i];
      bytesBefore += original.length;

      if (/^https?:\/\//.test(original)) {
        nextPhotos.push(original);
        skippedAlreadyUrl++;
        continue;
      }

      const parsed = parseDataUrl(original);
      if (!parsed) {
        console.warn(`  ! unparseable photo on ${row.id} (${row.name}), leaving as-is`);
        nextPhotos.push(original);
        unparseable++;
        continue;
      }

      const path = `${row.company_id}/${row.id}/${i}.${parsed.ext}`;
      let uploadError;
      for (let attempt = 1; attempt <= 4; attempt++) {
        ({ error: uploadError } = await admin.storage
          .from(BUCKET)
          .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: true }));
        if (!uploadError) break;
        console.warn(`  retry ${attempt}/4 for ${path}: ${uploadError.message}`);
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
      if (uploadError) throw new Error(`upload failed for ${path}: ${uploadError.message}`);

      const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);
      nextPhotos.push(publicUrlData.publicUrl);
      migratedPhotos++;
      changed = true;
    }

    if (changed) {
      const { error: updateError } = await admin
        .from("recommendations")
        .update({ photos: nextPhotos })
        .eq("id", row.id);
      if (updateError) throw new Error(`update failed for ${row.id}: ${updateError.message}`);
      rowsUpdated++;
      console.log(`  ✓ ${row.name} (${row.id}) — ${nextPhotos.length} photo(s) migrated`);
    }
  }

  console.log("\nDone.");
  console.log(`  rows updated: ${rowsUpdated}`);
  console.log(`  photos migrated: ${migratedPhotos}`);
  console.log(`  already URLs (skipped): ${skippedAlreadyUrl}`);
  console.log(`  unparseable (left as-is): ${unparseable}`);
  console.log(`  bytes removed from DB rows: ~${(bytesBefore / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
