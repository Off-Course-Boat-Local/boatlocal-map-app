"use client";

// Guide's own profile editor (PRD §6.2): photo upload + welcome message.
// Submits to updateGuideProfileAction as ordinary multipart form data (the
// browser sets that encoding automatically once a <form> contains a file
// input, regardless of `action` being a function) — the Server Action reads
// the File straight off the FormData and turns it into a data URL server
// side (see its own comment for why, and the TODO for what replaces that
// once real file storage exists).

import { useActionState, useState, type ChangeEvent } from "react";

import { updateGuideProfileAction, type UpdateGuideProfileActionState } from "@/lib/studio/guideActions";
import { GUIDE_WELCOME_MAX_LENGTH } from "@/lib/studio/guideProfile";
import { CARD_SHADOW, PrimaryButton } from "./primitives";

const initialState: UpdateGuideProfileActionState = {};

export interface GuideProfileFormProps {
  initialWelcomeMessage: string;
  initialAvatarUrl: string | null;
  avatarInitial: string;
}

export default function GuideProfileForm({
  initialWelcomeMessage,
  initialAvatarUrl,
  avatarInitial,
}: GuideProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateGuideProfileAction, initialState);
  const [welcome, setWelcome] = useState(initialWelcomeMessage);
  const [preview, setPreview] = useState<string | null>(initialAvatarUrl);

  const remaining = GUIDE_WELCOME_MAX_LENGTH - welcome.length;
  const nearLimit = remaining <= 20;

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Local, client-only preview — the actual upload only happens on submit.
    // Revoked implicitly on navigation; this page is short-lived enough that
    // an explicit revokeObjectURL isn't worth the extra state to track it.
    setPreview(URL.createObjectURL(file));
  };

  return (
    <form
      action={formAction}
      className={`space-y-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}
    >
      <p className="text-sm font-semibold text-[var(--studio-ink)]">Profile</p>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--studio-bg)] text-lg font-semibold text-[var(--studio-ink-soft)]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <span>{avatarInitial}</span>
          )}
        </div>
        <label className="text-sm font-medium text-[var(--studio-ink)]">
          Photo
          <input
            type="file"
            name="photo"
            accept="image/*"
            onChange={onPhotoChange}
            className="mt-1 block text-xs text-[var(--studio-ink-soft)] file:mr-2 file:rounded-lg file:border file:border-[var(--studio-border)] file:bg-[var(--studio-surface)] file:px-2 file:py-1 file:text-xs"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[var(--studio-ink)]">
        Welcome message
        <textarea
          name="welcomeMessage"
          value={welcome}
          onChange={(event) => setWelcome(event.target.value)}
          maxLength={GUIDE_WELCOME_MAX_LENGTH}
          rows={3}
          placeholder="Welcome! I've collected my favourite spots in the city, just for you."
          className="mt-1 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3.5 py-2.5 text-sm text-[var(--studio-ink)] outline-none transition-colors focus:border-[var(--studio-accent)] focus:ring-2 focus:ring-[var(--studio-accent)]/15"
        />
      </label>
      <p className={`text-xs ${nearLimit ? "text-amber-600" : "text-[var(--studio-ink-soft)]"}`}>
        {remaining} character{remaining === 1 ? "" : "s"} left
      </p>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </PrimaryButton>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm font-medium text-emerald-700">Saved.</p> : null}
    </form>
  );
}
