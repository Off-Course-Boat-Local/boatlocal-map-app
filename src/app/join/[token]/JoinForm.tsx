"use client";

// The 3-field signup form PRD §6.1 describes: name (pre-filled, editable),
// email (pre-filled, locked — see actions.ts for why), password (new).
// Submits to joinAction bound to this page's token.

import { useActionState } from "react";

import { joinAction, type JoinActionState } from "./actions";

const initialState: JoinActionState = {};

export default function JoinForm({
  token,
  defaultName,
  email,
}: {
  token: string;
  defaultName: string;
  email: string;
}) {
  const boundJoinAction = joinAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundJoinAction, initialState);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">You&rsquo;ve been invited</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Finish setting up your Studio account to start adding your own recommendations.
        </p>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Name
        <input
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
      </label>

      <label className="block text-sm font-medium text-neutral-700">
        Email
        {/* Locked: the token alone already identifies this guide row —
            editing this field client-side would only affect a submission
            actions.ts re-validates against guide.email server-side anyway. */}
        <input
          name="email"
          type="email"
          value={email}
          readOnly
          className="mt-1 w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 outline-none"
        />
      </label>

      <label className="block text-sm font-medium text-neutral-700">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
