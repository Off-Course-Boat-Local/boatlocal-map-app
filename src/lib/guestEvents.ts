"use server";

// Fire-and-forget analytics bridge for guest CLIENT components (PRD §10).
//
// src/lib/data/source.ts is the server-side DataSource interface (house
// rule: every screen reads through it, never Supabase directly) — a "use
// client" component cannot import it. This one-line Server Action is the
// crossing point: it calls the exact same recordEvent() a server-rendered
// page would, so there is still exactly one analytics write path, not a
// second one for client-triggered events.
//
// Deliberately swallows its own errors: a failed analytics call must never
// surface to the guest or block whatever they were actually trying to do
// (installing the app, tapping "book").

import { recordEvent } from "./data/source";
import { isPreviewRequest } from "./guestPreview";
import type { NewEventInput } from "./data/types";

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
