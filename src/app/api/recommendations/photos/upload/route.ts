// Shared photo-upload endpoint for RecommendationPhotosField — used by both
// Studio's and Admin's "Add / edit recommendation" forms, which is why this
// lives outside both /api/admin and /api/studio rather than picking one:
// RecommendationPhotosField.tsx is itself one shared component (imported by
// both AdminRecommendationForm.tsx and Studio's RecommendationForm.tsx), so
// it needs one endpoint that accepts either session type.
//
// Uploads straight to the `recommendation-photos` Storage bucket via the
// service-role client — see scripts/migrate-photos-to-storage.mjs and
// src/lib/admin/googlePlaces.ts's PHOTO_BUCKET comment for why photos live
// in Storage at all now, not inline as base64 in the row (guest /list and
// /saved were shipping the ENTIRE photo set as page payload on every
// navigation — 15–28 MB per load — founder report, 2026-09-02: "loading is
// very very slow").
//
// Not RLS-gated on the bucket itself (bypassed via the service-role
// client): the session check below is the actual gate, same posture as the
// Google Places enrichment routes it sits next to.

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin/devAuth";
import { getDevSession } from "@/lib/studio/devAuth";
import { createAdminClient } from "@/lib/supabase/admin";

const PHOTO_BUCKET = "recommendation-photos";
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB — matches RecommendationPhotosField's own client-side cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  // Either session is fine — this route serves both portals' forms; which
  // one is signed in tells us nothing this endpoint needs beyond "someone
  // with write access to a recommendations form is asking."
  const [studioSession, adminSession] = await Promise.all([getDevSession(), getAdminSession()]);
  if (!studioSession && !adminSession) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large." }, { status: 413 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `uploads/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
