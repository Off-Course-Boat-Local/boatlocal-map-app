"use client";

// Studio sign-in: a single email field, sending a real Supabase magic link.
// No password — Studio has no password auth. Submitting always shows a
// neutral "check your email" state (see requestMagicLinkAction's own
// comment for why), never revealing whether the address has an account.

import { useActionState } from "react";

import MapAppMark, { PORTAL_ACCENT } from "@/components/MapAppMark";
import { requestMagicLinkAction, type LoginActionState } from "@/lib/studio/actions";

const initialState: LoginActionState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLinkAction, initialState);

  if (state.sent) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-neutral-900">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
          <h1 className="text-xl font-semibold text-neutral-900">Check your email</h1>
          <p className="text-sm text-neutral-500">
            If that address has Studio access, a sign-in link is on its way. Open it on this
            device to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center text-neutral-900">
        <MapAppMark iconSize={26} className="text-lg" />
      </div>
      <form
        action={formAction}
        className="space-y-5 rounded-2xl bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]"
      >
        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Studio</p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">Sign in</h1>
          <p className="mt-2 text-sm text-neutral-500">
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
          style={{ background: PORTAL_ACCENT }}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending link…" : "Send sign-in link"}
        </button>
      </form>
    </div>
  );
}
