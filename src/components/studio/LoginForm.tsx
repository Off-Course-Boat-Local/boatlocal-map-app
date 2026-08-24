"use client";

// Studio sign-in: a single email field, sending a real Supabase magic link.
// No password — Studio has no password auth. Submitting always shows a
// neutral "check your email" state (see requestMagicLinkAction's own
// comment for why), never revealing whether the address has an account.

import { useActionState } from "react";

import MapAppMark from "@/components/MapAppMark";
import { displayFontFamily } from "@/lib/fonts";
import { requestMagicLinkAction, type LoginActionState } from "@/lib/studio/actions";
import { CARD_SHADOW, PrimaryButton, inputClass, labelClass } from "./primitives";

const initialState: LoginActionState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLinkAction, initialState);

  if (state.sent) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--studio-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>
        <div className={`space-y-3 rounded-2xl bg-[var(--studio-surface)] p-8 text-center ${CARD_SHADOW}`}>
          <h1
            style={{ fontFamily: displayFontFamily }}
            className="text-xl font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
          >
            Check your email
          </h1>
          <p className="text-sm text-[var(--studio-ink-soft)]">
            If that address has Studio access, a sign-in link is on its way. Open it on this
            device to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center text-[var(--studio-ink)]">
        <MapAppMark iconSize={26} className="text-lg" />
      </div>
      <form
        action={formAction}
        className={`space-y-5 rounded-2xl bg-[var(--studio-surface)] p-8 ${CARD_SHADOW}`}
      >
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--studio-ink-soft)] uppercase">
            Studio
          </p>
          <h1
            style={{ fontFamily: displayFontFamily }}
            className="mt-1 text-xl font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
          >
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--studio-ink-soft)]">
            Enter your email and we&rsquo;ll send you a sign-in link. No password needed.
          </p>
        </div>

        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="jan@example.com"
            className={inputClass}
          />
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={pending} className="w-full">
          {pending ? "Sending link…" : "Send sign-in link"}
        </PrimaryButton>
      </form>
    </div>
  );
}
