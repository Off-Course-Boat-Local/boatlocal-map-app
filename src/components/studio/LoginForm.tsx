"use client";

// Studio sign-in: a single email field, sending a real Supabase magic link.
// No password — Studio has no password auth. Submitting always shows a
// neutral "check your email" state (see requestMagicLinkAction's own
// comment for why), never revealing whether the address has an account.

import { useActionState } from "react";

import { requestMagicLinkAction, type LoginActionState } from "@/lib/studio/actions";

const initialState: LoginActionState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLinkAction, initialState);

  if (state.sent) {
    return (
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Check your email</h1>
        <p className="text-sm text-neutral-500">
          If that address has Studio access, a sign-in link is on its way. Open it on this
          device to continue.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Studio</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we&rsquo;ll send you a sign-in link. No password needed.
        </p>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="jan@example.com"
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
        {pending ? "Sending link…" : "Send sign-in link"}
      </button>
    </form>
  );
}
