"use client";

// Studio Guides — invite form (PRD §7.3). Submits to inviteGuideAction,
// which creates the guide row (status "invited") and mints the invite link
// shown once the list below re-renders (Server Actions revalidate the page,
// so there is nothing else this component needs to do on success besides
// clear itself).

import { useActionState, useEffect, useRef } from "react";

import { inviteGuideAction, type InviteGuideActionState } from "@/lib/studio/guideActions";

const initialState: InviteGuideActionState = {};

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

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
    <form ref={formRef} action={formAction} className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-neutral-900">Invite a guide</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1 text-sm font-medium text-neutral-700">
          Name
          <input name="name" required placeholder="Maria" className={inputClass} />
        </label>
        <label className="min-w-[200px] flex-1 text-sm font-medium text-neutral-700">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="maria@example.com"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Inviting…" : "Invite guide"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 text-sm text-green-700">
          Invite created — find their link under &ldquo;Invite link&rdquo; in the list below.
        </p>
      ) : null}
    </form>
  );
}
