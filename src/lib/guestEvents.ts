"use server";

// Fire-and-forget analytics bridge for guest CLIENT components (PRD §10).
//
// src/lib/data/source.ts is the server-side DataSource interface (house
// rule: every screen reads through it, never Supabase directly) — a "use
// client" component cannot import it. These one-line Server Actions are the
// crossing point: each calls the exact same source.ts function a server-
// rendered page would, so there is still exactly one write path per table,
// not a second one for client-triggered writes.
//
// Deliberately swallows its own errors: a failed analytics/feedback call
// must never surface to the guest or block whatever they were actually
// trying to do (installing the app, tapping "book", leaving a rating).

import { recordEvent, recordGuestReview as recordGuestReviewRow } from "./data/source";
import { isPreviewRequest } from "./guestPreview";
import type { NewEventInput, NewGuestReviewInput } from "./data/types";

export async function recordGuestEvent(input: NewEventInput): Promise<void> {
  // Studio's preview renders the real guest app so it can be clicked
  // through for real — which means the clicks arrive here looking exactly
  // like a guest's. Drop them: a preview is not a visit, and counting it
  // would inflate the very numbers the previewer is being shown elsewhere
  // in Studio. This is the single analytics write path for anything a guest
  // does (see this module's header), so suppressing here covers every
  // screen without each one having to remember.
  if (await isPreviewRequest()) return;

  try {
    await recordEvent(input);
  } catch {
    // Analytics failures are not the guest's problem.
  }
}

/**
 * Same crossing point as recordGuestEvent above, for the Review screen's
 * `guest_reviews` writes (supabase/migrations/20260824000000_guest_reviews.sql)
 * instead of `events` — same preview-guard, fire-and-forget, error-swallowing
 * contract: a slow or failed write here must never block the guest, and
 * Studio's own preview clicks must never be recorded as a real rating.
 */
export async function recordGuestReview(input: NewGuestReviewInput): Promise<void> {
  if (await isPreviewRequest()) return;

  try {
    await recordGuestReviewRow(input);
  } catch {
    // Feedback-write failures are not the guest's problem.
  }
}
