// One-time data migration: companies.logo_url moves from a base64 data URI
// embedded in the row to a plain https URL in the `company-logos` Storage
// bucket.
//
// WHY: the guest layout resolves the brand (and therefore the logo) on EVERY
// guest route, and Next serialises it twice — once into the SSR'd <img> and
// again into the RSC flight payload. Off Course Amsterdam's logo was a 148 KB
// base64 PNG, which meant ~300 KB of every single guest page was one image,
// inlined and uncacheable (base64-of-PNG barely compresses, which is why a
// 374 KB page only gzipped to 239 KB). Measured 2026-09-02: 80.9% of /map's
// HTML was this one logo.
//
// Same fix, same reasoning as scripts/migrate-photos-to-storage.mjs — that
// migration moved recommendation photos out of the DB but missed the company
// logo, which lives on a different table.
//
// Idempotent: skips any logo that is already an https URL.
//
// Usage: node --env-file=.env.local scripts/migrate-logos-to-storage.mjs

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
const BUCKET = "company-logos";

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/svg+xml" ? "svg" : "jpg";
  return { mime, ext, buffer: Buffer.from(base64, "base64") };
}

async function main() {
  const { data: rows, error } = await admin.from("companies").select("id, name, logo_url");
  if (error) throw error;

  let migrated = 0;
  let skipped = 0;
  let bytesRemoved = 0;

  for (const row of rows) {
    if (!row.logo_url) continue;

    if (/^https?:\/\//.test(row.logo_url)) {
      skipped++;
      continue;
    }

    const parsed = parseDataUrl(row.logo_url);
    if (!parsed) {
      console.warn(`  ! unparseable logo on ${row.name} (${row.id}), leaving as-is`);
      continue;
    }

    bytesRemoved += row.logo_url.length;
    const path = `${row.id}.${parsed.ext}`;

    let uploadError;
    for (let attempt = 1; attempt <= 4; attempt++) {
      ({ error: uploadError } = await admin.storage.from(BUCKET).upload(path, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true,
        // Content-addressed by company id and replaced in place on re-upload,
        // so a long TTL is safe — and the transform CDN keys off the same URL.
        cacheControl: "31536000",
      }));
      if (!uploadError) break;
      console.warn(`  retry ${attempt}/4 for ${path}: ${uploadError.message}`);
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
    if (uploadError) throw new Error(`upload failed for ${path}: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { error: updateError } = await admin
      .from("companies")
      .update({ logo_url: publicUrl })
      .eq("id", row.id);
    if (updateError) throw new Error(`update failed for ${row.id}: ${updateError.message}`);

    migrated++;
    console.log(`  ✓ ${row.name} — ${(parsed.buffer.length / 1024).toFixed(0)} KB moved to Storage`);
  }

  console.log("\nDone.");
  console.log(`  logos migrated: ${migrated}`);
  console.log(`  already URLs (skipped): ${skipped}`);
  console.log(`  base64 removed from DB rows: ~${(bytesRemoved / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
