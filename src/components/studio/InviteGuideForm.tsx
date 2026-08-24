"use client";

// Studio Guides — invite form (PRD §7.3). Submits to inviteGuideAction,
// which creates the guide row (status "invited") and mints the invite link
// shown once the list below re-renders (Server Actions revalidate the page,
// so there is nothing else this component needs to do on success besides
// clear itself).

import { useActionState, useEffect, useRef } from "react";

import { inviteGuideAction, type InviteGuideActionState } from "@/lib/studio/guideActions";
import { CARD_SHADOW, PrimaryButton, inputClass } from "./primitives";

const initialState: InviteGuideActionState = {};

export default function InviteGuideForm() {
  const [state, formAction, pending] = useActionState(inviteGuideAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // `state` is a fresh object on every dispatch (including repeated
  // successes), so this fires after each successful submit, not just the
  // first — clearing the form for the next invite.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}
    >
      <p className="mb-3 text-sm font-semibold text-[var(--studio-ink)]">Invite a guide</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1 text-sm font-medium text-[var(--studio-ink)]">
          Name
          <input name="name" required placeholder="Maria" className={inputClass} />
        </label>
        <label className="min-w-[200px] flex-1 text-sm font-medium text-[var(--studio-ink)]">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="maria@example.com"
            className={inputClass}
          />
        </label>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite guide"}
        </PrimaryButton>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">
          Invite created — find their link under &ldquo;Invite link&rdquo; in the list below.
        </p>
      ) : null}
    </form>
  );
}
