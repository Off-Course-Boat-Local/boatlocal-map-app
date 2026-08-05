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
    <form action={formAction} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm font-medium text-neutral-900">Profile</p>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-lg font-semibold text-neutral-700">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <span>{avatarInitial}</span>
          )}
        </div>
        <label className="text-sm font-medium text-neutral-700">
          Photo
          <input
            type="file"
            name="photo"
            accept="image/*"
            onChange={onPhotoChange}
            className="mt-1 block text-xs text-neutral-500 file:mr-2 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-2 file:py-1 file:text-xs"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Welcome message
        <textarea
          name="welcomeMessage"
          value={welcome}
          onChange={(event) => setWelcome(event.target.value)}
          maxLength={GUIDE_WELCOME_MAX_LENGTH}
          rows={3}
          placeholder="Welcome! I've collected my favourite spots in the city, just for you."
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
      </label>
      <p className={`text-xs ${nearLimit ? "text-amber-600" : "text-neutral-500"}`}>
        {remaining} character{remaining === 1 ? "" : "s"} left
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-green-700">Saved.</p> : null}
    </form>
  );
}
