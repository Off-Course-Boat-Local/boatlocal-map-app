// Pure text-cleanup helpers for AI-parsed hints — deliberately no
// "server-only" import (unlike voiceAssistant.ts) so this stays importable
// from tests without pulling in the OpenAI client/API key check.

const NULL_LOOKALIKES = new Set(["null", "none", "n/a", "na", "undefined"]);

/**
 * gpt-4o-mini's structured output occasionally writes the *string* "null"
 * (or similar filler) for a nullable field instead of the JSON null the
 * schema actually allows — observed live for `noteHint` in
 * src/app/api/studio/places/assistant/route.ts even though its schema type
 * is `["string", "null"]`. Left unguarded, that string is truthy and wins
 * a `||` fallback chain, showing up verbatim as a candidate's draft note.
 * Treated as "said nothing" rather than filtered silently, so the real
 * fallback (e.g. a vibe-summary draft, or an empty field) still wins.
 */
export function cleanHint(hint: string | null | undefined): string | null {
  const trimmed = hint?.trim();
  if (!trimmed) return null;
  return NULL_LOOKALIKES.has(trimmed.toLowerCase()) ? null : trimmed;
}
