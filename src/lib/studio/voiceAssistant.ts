// OpenAI-backed "talk to add places" assistant for Studio's Recommendations
// page — a guide/company owner records a short voice command ("add Duende
// as a restaurant, it's got great tapas") or types the same thing, and this
// module turns that into structured place-add requests for
// /api/studio/places/assistant/route.ts to run through the existing Google
// Places search+details pipeline (src/lib/admin/googlePlaces.ts).
//
// REQUEST-BASED, NOT REALTIME: OpenAI's own audio guide splits audio work
// into "request-based APIs" (you have a file or a bounded request) vs.
// "realtime sessions" (live, low-latency, ongoing conversational state).
// This is a one-shot "record a command, get text back" flow — a Realtime
// speech-to-speech session (WebRTC, ephemeral keys, persistent connection)
// would be substantially more infrastructure for no benefit here, so
// transcription uses the plain request-based endpoint.
//
// Server-only: the API key never reaches the browser.

import "server-only";

import type { CategoryId } from "@/lib/types";

const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const PARSE_MODEL = "gpt-4o-mini";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set. Check .env.local.");
  return key;
}

/**
 * Transcribes a short voice clip (webm/mp4/wav from the browser's
 * MediaRecorder) into text via OpenAI's request-based transcription
 * endpoint.
 */
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "wav";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `clip.${ext}`);
  form.append("model", TRANSCRIBE_MODEL);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription failed: ${res.status}`);
  }
  const body = (await res.json()) as { text?: string };
  return (body.text ?? "").trim();
}

export interface ParsedPlaceRequest {
  /** Plain venue name, as best extracted from the transcript. */
  name: string;
  /** A category the phrasing implied ("as a restaurant"), or null. */
  categoryHint: CategoryId | null;
  /**
   * Any descriptive remarks about this place in the transcript ("easy to
   * walk in without reservation", "great sandwiches"), pre-filling the
   * note field as a draft — never auto-invented, only ever what the person
   * actually said. Still required to be reviewed/edited before saving,
   * same as every other field in the staged card.
   */
  noteHint: string | null;
}

const CATEGORY_HINT_VALUES = [
  "breakfast",
  "lunch",
  "coffee",
  "drinks",
  "dancing",
  "see",
  "photo",
  "shop",
] as const;

/**
 * Extracts every distinct "add this place" request from a free-form
 * transcript via a structured-output chat completion — the one place in
 * this app that calls a general-purpose LLM; category *matching* for a
 * confirmed Google Places result still goes through the deterministic
 * guessCategories() in googlePlaces.ts, this only interprets what the human
 * said.
 */
export async function parsePlaceRequests(transcript: string): Promise<ParsedPlaceRequest[]> {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: PARSE_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You extract place-add requests from a guide or company owner's spoken/typed " +
            "command for a guest recommendations app covering Amsterdam. Given a transcript, " +
            "return every distinct place they want added. For each: `name` is the plain venue " +
            "name only (no filler words); `categoryHint` is a category ONLY if the phrasing " +
            `clearly implies one (valid values: ${CATEGORY_HINT_VALUES.join(", ")} — otherwise ` +
            "null, never guess); `noteHint` is any descriptive remark they made about that " +
            "specific place (why it's good, what to order, when to go) as a short standalone " +
            "sentence, or null if they said nothing beyond the name. Never invent a place that " +
            "wasn't actually named in the transcript.",
        },
        { role: "user", content: trimmed },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "place_requests",
          strict: true,
          schema: {
            type: "object",
            properties: {
              requests: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    categoryHint: {
                      type: ["string", "null"],
                      enum: [...CATEGORY_HINT_VALUES, null],
                    },
                    noteHint: { type: ["string", "null"] },
                  },
                  required: ["name", "categoryHint", "noteHint"],
                  additionalProperties: false,
                },
              },
            },
            required: ["requests"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Parsing failed: ${res.status}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { requests: ParsedPlaceRequest[] };
  return parsed.requests
    .map((r) => ({ ...r, name: r.name.trim() }))
    .filter((r) => r.name.length > 0);
}

/**
 * A one-sentence "why it's nice" read on a place, synthesized from Google
 * reviewers' own words — curation context for whoever is deciding whether
 * to add this place (see googlePlaces.ts's PlaceDetails doc comment: this
 * NEVER gets written to a recommendations row or shown to a guest, only
 * displayed in the add-flow itself). Returns null rather than inventing
 * anything if there's nothing to go on.
 */
export async function summarizeVibe(reviewSnippets: string[]): Promise<string | null> {
  if (reviewSnippets.length === 0) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: PARSE_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You read a handful of Google review excerpts for one venue and write ONE short " +
            "sentence (max ~20 words) capturing the general vibe/why people like it — plain, " +
            "specific, no marketing language, no exclamation marks, no star-rating talk. Base " +
            "it only on what the reviews actually say; never invent details.",
        },
        { role: "user", content: reviewSnippets.join("\n\n---\n\n") },
      ],
      max_tokens: 60,
    }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content?.trim() || null;
}
