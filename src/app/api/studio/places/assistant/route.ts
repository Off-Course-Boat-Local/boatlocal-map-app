// Studio-gated "talk to add places" pipeline: transcribe (if audio) ->
// parse into place-add requests -> Google Places search + details for
// each -> return a staged list for the person to confirm/adjust one by
// one, never auto-saved. See src/lib/studio/voiceAssistant.ts and
// src/lib/admin/googlePlaces.ts for the two halves this composes.
//
// PHOTO CAP: capped at 3 per candidate here, deliberately lower than the
// 8 a manual "Search Google Maps" pick gets — bulk-adding several
// candidates from one voice command multiplies fast, and 8 photos/place
// already caused Postgres statement timeouts once at moderate volume (see
// the project's own memory on this). 3 is enough to judge the place is
// right; more can always be added by hand after saving.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { searchPlaces, getPlaceDetails, guessCategories } from "@/lib/admin/googlePlaces";
import { transcribeAudio, parsePlaceRequests, summarizeVibe } from "@/lib/studio/voiceAssistant";
import { cleanHint } from "@/lib/studio/textHints";
import { getDevSession } from "@/lib/studio/devAuth";
import type { CategoryId } from "@/lib/types";

const CANDIDATE_PHOTO_CAP = 3;
const MAX_ALTERNATES = 3;

export interface StagedCandidate {
  tempId: string;
  query: string;
  name: string;
  categories: CategoryId[];
  area: string;
  address: string;
  lng: number | null;
  lat: number | null;
  hours: string;
  photos: string[];
  note: string;
  alternates: Array<{ placeId: string; name: string; address: string }>;
  notFound?: boolean;
  /**
   * Curation context ONLY — never saved to the recommendation row, never
   * shown to a guest (see PlaceDetails' own doc comment in
   * googlePlaces.ts). Purely to help decide whether this is worth adding
   * and to inform the note the person actually writes.
   */
  rating: number | null;
  reviewCount: number | null;
  vibeSummary: string | null;
}

export async function POST(request: NextRequest) {
  const session = await getDevSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let transcript: string;
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const text = formData.get("text");

    if (audioFile instanceof File) {
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      transcript = await transcribeAudio(buffer, audioFile.type || "audio/webm");
    } else if (typeof text === "string") {
      transcript = text;
    } else {
      return NextResponse.json({ error: "No audio or text provided." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Could not transcribe that clip." }, { status: 502 });
  }

  if (!transcript.trim()) {
    return NextResponse.json({ error: "Didn't catch any place names in that." }, { status: 422 });
  }

  let requests;
  try {
    requests = await parsePlaceRequests(transcript);
  } catch {
    return NextResponse.json({ error: "Could not understand that request." }, { status: 502 });
  }

  if (requests.length === 0) {
    return NextResponse.json({
      transcript,
      candidates: [] as StagedCandidate[],
      error: "Didn't catch any place names in that — try naming them more directly.",
    });
  }

  const candidates: StagedCandidate[] = await Promise.all(
    requests.map(async (req, i): Promise<StagedCandidate> => {
      const tempId = `cand-${i}-${Date.now()}`;
      const results = await searchPlaces(req.name);

      if (results.length === 0) {
        return {
          tempId,
          query: req.name,
          name: req.name,
          categories: req.categoryHint ? [req.categoryHint] : [],
          area: "",
          address: "",
          lng: null,
          lat: null,
          hours: "",
          photos: [],
          note: cleanHint(req.noteHint) ?? "",
          alternates: [],
          notFound: true,
          rating: null,
          reviewCount: null,
          vibeSummary: null,
        };
      }

      const [top, ...rest] = results;
      const details = await getPlaceDetails(top.placeId);
      // Depends on details.reviewSnippets, so this can't start until the
      // details call above resolves — genuinely sequential, not parallel.
      const vibeSummary = await summarizeVibe(details.reviewSnippets).catch(() => null);
      const guessed = guessCategories(top.types) as CategoryId[];

      // Category order: the human's spoken hint always wins the primary
      // slot (pin colour), Google's own guesses fill in behind it —
      // same merge order the manual "Search Google Maps" apply uses.
      const categories: CategoryId[] = [];
      if (req.categoryHint) categories.push(req.categoryHint);
      for (const c of guessed) {
        if (!categories.includes(c)) categories.push(c);
      }

      // The note field's draft: the person's own words (from speech/text)
      // always win if they said anything descriptive; otherwise the
      // AI-drafted vibe line from reviews fills in as an editable
      // starting point rather than leaving the field empty. Either way
      // it's still just a draft — nothing saves until they confirm the
      // card, and the field stays fully editable in the UI.
      const note = cleanHint(req.noteHint) || vibeSummary || "";

      return {
        tempId,
        query: req.name,
        name: details.name || top.name,
        categories,
        area: details.area,
        address: details.address,
        lng: Number.isFinite(details.lng) ? details.lng : null,
        lat: Number.isFinite(details.lat) ? details.lat : null,
        hours: details.hours,
        photos: details.photos.slice(0, CANDIDATE_PHOTO_CAP),
        rating: details.rating,
        reviewCount: details.reviewCount,
        vibeSummary,
        note,
        alternates: rest.slice(0, MAX_ALTERNATES).map((r) => ({
          placeId: r.placeId,
          name: r.name,
          address: r.address,
        })),
      };
    }),
  );

  return NextResponse.json({ transcript, candidates });
}
