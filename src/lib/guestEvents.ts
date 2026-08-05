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
import type { NewEventInput } from "./data/types";

export async function recordGuestEvent(input: NewEventInput): Promise<void> {
  try {
    await recordEvent(input);
  } catch {
    // Analytics failures are not the guest's problem.
  }
}
