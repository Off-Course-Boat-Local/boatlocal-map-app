"use client";

// "Talk to add places" — a guide/company owner records a short voice
// command (or types the same thing) naming one or more places, and gets
// back a staged list of candidates found via Google Places, each shown
// with its category/note editable and its own explicit "this is the right
// one" confirm button — nothing saves until they say so, one place at a
// time (founder request, 2026-09-01).
//
// Server-side pipeline: transcribe (OpenAI, request-based, not a Realtime
// session) -> parse into place requests (OpenAI structured output) ->
// Google Places search+details per request — all in
// /api/studio/places/assistant/route.ts. This component only drives that
// endpoint and the confirm/skip/adjust UI on its response.
//
// SAVING reuses saveRecommendationAction exactly as the real form does —
// each card builds the same FormData a typed-out submission would, so
// every validation rule (non-empty note, at least one category, a real
// lng/lat) applies here too. This is a UI on top of the existing save
// path, not a second one.

import { useRef, useState } from "react";
import { Loader2, Mic, Search, Sparkles, Square } from "lucide-react";

import { RECOMMENDATION_CATEGORIES } from "@/lib/studio/recommendationForm";
import { saveRecommendationAction } from "@/lib/studio/recommendationActions";
import RatingBadge from "@/components/map/RatingBadge";
import type { CategoryId } from "@/lib/types";
import type { PlaceSearchResult } from "@/lib/admin/googlePlaces";
import type { StagedCandidate } from "@/app/api/studio/places/assistant/route";
import { GhostButton, PrimaryButton, inputClass } from "./primitives";

type CandidateStatus = "pending" | "saving" | "saved" | "skipped" | "error";

interface StagedCandidateState extends StagedCandidate {
  status: CandidateStatus;
  error?: string;
}

export interface VoiceAddPlacesProps {
  /** Called once every staged candidate has been either saved or skipped. */
  onAllDone: () => void;
}

export default function VoiceAddPlaces({ onAllDone }: VoiceAddPlacesProps) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StagedCandidateState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void submit(() => {
          const fd = new FormData();
          fd.append("audio", blob, "clip.webm");
          return fd;
        });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone — check your browser permissions, or type instead.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function submitText() {
    if (!text.trim()) return;
    void submit(() => {
      const fd = new FormData();
      fd.append("text", text);
      return fd;
    });
  }

  async function submit(buildFormData: () => FormData) {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/places/assistant", {
        method: "POST",
        body: buildFormData(),
      });
      const body = (await res.json()) as {
        transcript?: string;
        candidates?: StagedCandidate[];
        error?: string;
      };
      if (body.error && (!body.candidates || body.candidates.length === 0)) {
        setError(body.error);
        return;
      }
      setTranscript(body.transcript ?? null);
      setCandidates((body.candidates ?? []).map((c) => ({ ...c, status: "pending" as const })));
    } catch {
      setError("Something went wrong processing that.");
    } finally {
      setProcessing(false);
    }
  }

  function updateCandidate(tempId: string, patch: Partial<StagedCandidateState>) {
    setCandidates((prev) => prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)));
  }

  async function pickAlternate(tempId: string, placeId: string) {
    const current = candidates.find((x) => x.tempId === tempId);
    try {
      const res = await fetch(
        `/api/studio/places/details?placeId=${encodeURIComponent(placeId)}&withVibe=1`,
      );
      const body = (await res.json()) as {
        details?: {
          name: string;
          area: string;
          address: string;
          lng: number;
          lat: number;
          hours: string;
          photos: string[];
          rating: number | null;
          reviewCount: number | null;
        };
        vibeSummary?: string | null;
      };
      if (body.details) {
        const vibeSummary = body.vibeSummary ?? null;
        // The endorsement re-drafts along with the swap, same as the
        // initial draft: only when the person hasn't typed their own
        // words yet (empty, or still exactly the old draft) — a note
        // they've already written stays theirs, even across a swap.
        const noteWasAutoDrafted = !current?.note.trim() || current.note === current.vibeSummary;
        updateCandidate(tempId, {
          name: body.details.name,
          area: body.details.area,
          address: body.details.address,
          lng: body.details.lng,
          lat: body.details.lat,
          hours: body.details.hours,
          photos: body.details.photos.slice(0, 3),
          rating: body.details.rating,
          reviewCount: body.details.reviewCount,
          vibeSummary,
          note: noteWasAutoDrafted ? (vibeSummary ?? "") : current!.note,
          notFound: false,
        });
      }
    } catch {
      updateCandidate(tempId, { error: "Could not load that place's details." });
    }
  }

  function toggleCategory(c: StagedCandidateState, id: CategoryId) {
    const next = c.categories.includes(id)
      ? c.categories.filter((x) => x !== id)
      : [...c.categories, id];
    updateCandidate(c.tempId, { categories: next, error: undefined });
  }

  async function confirmCandidate(c: StagedCandidateState) {
    if (!c.note.trim()) {
      updateCandidate(c.tempId, { error: "Add a note before saving — that's the endorsement." });
      return;
    }
    if (c.categories.length === 0) {
      updateCandidate(c.tempId, { error: "Choose at least one category." });
      return;
    }
    if (c.lng == null || c.lat == null) {
      updateCandidate(c.tempId, { error: "No location found for this one." });
      return;
    }

    updateCandidate(c.tempId, { status: "saving", error: undefined });

    const formData = new FormData();
    formData.set("name", c.name);
    formData.set("area", c.area);
    formData.set("address", c.address);
    formData.set("lng", String(c.lng));
    formData.set("lat", String(c.lat));
    formData.set("hours", c.hours);
    formData.set("note", c.note);
    formData.set("visible", "on");
    c.categories.forEach((cat) => formData.append("categories", cat));
    c.photos.forEach((p) => formData.append("photos", p));
    if (c.rating != null) formData.set("googleRating", String(c.rating));
    if (c.reviewCount != null) formData.set("googleReviewCount", String(c.reviewCount));

    const result = await saveRecommendationAction({}, formData);
    if (result.error) {
      updateCandidate(c.tempId, { status: "error", error: result.error });
    } else {
      updateCandidate(c.tempId, { status: "saved" });
    }
  }

  function skipCandidate(tempId: string) {
    updateCandidate(tempId, { status: "skipped" });
  }

  function reset() {
    setCandidates([]);
    setTranscript(null);
    setText("");
    setError(null);
  }

  const allSettled =
    candidates.length > 0 &&
    candidates.every((c) => c.status === "saved" || c.status === "skipped");

  return (
    <div className="space-y-5">
      {candidates.length === 0 ? (
        <>
          <p className="text-sm text-[var(--studio-ink-soft)]">
            Say or type what you want to add — e.g. &quot;Add Duende as a restaurant, great
            tapas and easy to walk in without a reservation.&quot;
          </p>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={processing}
              className={`flex size-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-colors disabled:opacity-50 ${
                recording
                  ? "animate-pulse bg-red-600"
                  : "bg-[var(--studio-accent)] hover:opacity-90"
              }`}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? <Square className="size-5" /> : <Mic className="size-6" />}
            </button>
            <div className="flex-1 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="...or type it instead"
                className={inputClass}
                disabled={recording || processing}
              />
              <PrimaryButton
                onClick={submitText}
                disabled={!text.trim() || processing || recording}
                className="w-full"
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Find these places
              </PrimaryButton>
            </div>
          </div>

          {processing ? (
            <p className="text-xs text-[var(--studio-ink-soft)]">
              Listening, searching Google Maps…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {transcript ? (
            <p className="rounded-xl bg-[var(--studio-bg)] px-3 py-2 text-xs text-[var(--studio-ink-soft)]">
              Heard: &quot;{transcript}&quot;
            </p>
          ) : null}

          <div className="space-y-4">
            {candidates.map((c) => (
              <CandidateCard
                key={c.tempId}
                candidate={c}
                onToggleCategory={(id) => toggleCategory(c, id)}
                onNoteChange={(note) => updateCandidate(c.tempId, { note, error: undefined })}
                onNameChange={(name) => updateCandidate(c.tempId, { name })}
                onPickAlternate={(placeId) => pickAlternate(c.tempId, placeId)}
                onConfirm={() => confirmCandidate(c)}
                onSkip={() => skipCandidate(c.tempId)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <GhostButton onClick={reset}>Start over</GhostButton>
            {allSettled ? <PrimaryButton onClick={onAllDone}>Done</PrimaryButton> : null}
          </div>
        </>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  onToggleCategory,
  onNoteChange,
  onNameChange,
  onPickAlternate,
  onConfirm,
  onSkip,
}: {
  candidate: StagedCandidateState;
  onToggleCategory: (id: CategoryId) => void;
  onNoteChange: (note: string) => void;
  onNameChange: (name: string) => void;
  onPickAlternate: (placeId: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const c = candidate;
  const isDone = c.status === "saved" || c.status === "skipped";

  return (
    <div
      className={`rounded-2xl border p-4 transition-opacity ${isDone ? "opacity-50" : ""}`}
      style={{ borderColor: "var(--studio-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {c.notFound ? (
            <p className="text-sm font-semibold text-[var(--studio-ink)]">
              Couldn&apos;t find &quot;{c.query}&quot; — add it manually instead.
            </p>
          ) : (
            <input
              value={c.name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={isDone}
              className="w-full border-none bg-transparent p-0 text-base font-semibold text-[var(--studio-ink)] outline-none"
            />
          )}
          {!c.notFound ? (
            <p className="truncate text-xs text-[var(--studio-ink-soft)]">
              {c.address || c.area}
            </p>
          ) : null}
          {c.rating != null ? (
            <RatingBadge
              rating={c.rating}
              reviewCount={c.reviewCount}
              size={12}
              style={{ marginTop: 4, fontSize: 12 }}
            />
          ) : null}
        </div>
        {c.status === "saved" ? (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Added
          </span>
        ) : c.status === "skipped" ? (
          <span className="shrink-0 rounded-full bg-[var(--studio-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--studio-ink-soft)]">
            Skipped
          </span>
        ) : null}
      </div>

      {!isDone ? (
        <div className="mt-3">
          {!c.notFound ? (
            <p className="text-xs font-medium text-[var(--studio-ink-soft)]">Not the right one?</p>
          ) : null}
          {c.alternates.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {c.alternates.map((alt) => (
                <button
                  key={alt.placeId}
                  type="button"
                  onClick={() => onPickAlternate(alt.placeId)}
                  className="rounded-full border px-2.5 py-1 text-xs hover:bg-[var(--studio-bg)]"
                  style={{ borderColor: "var(--studio-border)" }}
                >
                  {alt.name}
                </button>
              ))}
            </div>
          ) : null}
          <ManualSearchBlock onPick={onPickAlternate} />
          {c.notFound ? (
            <div className="mt-3 flex justify-end">
              <GhostButton onClick={onSkip}>Skip</GhostButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {!c.notFound && !isDone ? (
        <>
          {c.photos.length > 0 ? (
            <div className="mt-3 flex gap-2">
              {c.photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-lg border object-cover"
                  style={{ borderColor: "var(--studio-border)" }}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {RECOMMENDATION_CATEGORIES.map((cat) => {
              const checked = c.categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggleCategory(cat.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    checked
                      ? "border-[var(--studio-accent)] bg-[var(--studio-accent)]/10 text-[var(--studio-accent)]"
                      : "border-[var(--studio-border)] text-[var(--studio-ink-soft)]"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {c.vibeSummary && c.note === c.vibeSummary ? (
            <p className="mt-3 text-xs text-[var(--studio-ink-soft)]">
              Drafted from Google reviews — read it over, or rewrite it as your own.
            </p>
          ) : null}
          <textarea
            value={c.note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder="Your note — why you'd send a guest here"
            className={`${inputClass} ${c.vibeSummary && c.note === c.vibeSummary ? "mt-1.5" : "mt-3"}`}
          />

          {c.error ? <p className="mt-2 text-xs text-red-600">{c.error}</p> : null}

          <div className="mt-3 flex justify-end gap-2">
            <GhostButton onClick={onSkip}>Skip</GhostButton>
            <PrimaryButton onClick={onConfirm} disabled={c.status === "saving"}>
              {c.status === "saving" ? "Adding…" : "This is the right one — add it"}
            </PrimaryButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ManualSearchBlock({ onPick }: { onPick: (placeId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/places/search?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { results?: PlaceSearchResult[]; error?: string };
      setResults(body.results ?? []);
      if (body.error) setError(body.error);
    } catch {
      setError("Google search is unavailable right now.");
    } finally {
      setSearching(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--studio-accent)] hover:opacity-80"
      >
        <Search className="size-3" />
        Search for the right place
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Type the name to search Google Maps"
          className={`${inputClass} py-1.5 text-sm`}
          autoFocus
        />
        <GhostButton size="sm" onClick={runSearch} disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
        </GhostButton>
      </div>

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}

      {results.length > 0 ? (
        <ul
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-xl border py-1"
          style={{ borderColor: "var(--studio-border)" }}
        >
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(r.placeId);
                  setOpen(false);
                  setQuery("");
                  setResults([]);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-[var(--studio-bg)]"
              >
                <span className="block truncate text-sm font-medium text-[var(--studio-ink)]">{r.name}</span>
                {r.address ? (
                  <span className="block truncate text-xs text-[var(--studio-ink-soft)]">{r.address}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!searching && results.length === 0 && !error && query.trim().length >= 2 ? (
        <p className="text-xs text-[var(--studio-ink-soft)]">Press search, or Enter, to look it up.</p>
      ) : null}
    </div>
  );
}
