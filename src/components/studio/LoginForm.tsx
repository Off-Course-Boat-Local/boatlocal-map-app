"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, KeyRound, Mail, Lock } from "lucide-react";

import MapAppMark from "@/components/MapAppMark";
import { displayFontFamily } from "@/lib/fonts";
import {
  checkStudioLoginMethodAction,
  signInStudioWithPasswordAction,
  type StudioLoginState,
} from "@/lib/studio/actions";
import { CARD_SHADOW, PrimaryButton, inputClass, labelClass } from "./primitives";

const initialState: StudioLoginState = {};

export default function LoginForm() {
  const [step1State, step1Action, step1Pending] = useActionState(
    checkStudioLoginMethodAction,
    initialState,
  );
  const [step2State, step2Action, step2Pending] = useActionState(
    signInStudioWithPasswordAction,
    initialState,
  );

  const [localEmail, setLocalEmail] = useState("");
  const [resettingEmail, setResettingEmail] = useState(false);

  const isPasswordMode =
    !resettingEmail && (step1State.passwordMode || step2State.passwordMode);
  const activeEmail = step2State.email || step1State.email || localEmail;
  const activeError = isPasswordMode ? step2State.error : step1State.error;
  const isPending = step1Pending || step2Pending;

  // Sent State (Password setup email sent)
  if (step1State.sent) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--studio-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>
        <div className={`space-y-4 rounded-2xl bg-[var(--studio-surface)] p-8 text-center ${CARD_SHADOW}`}>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-[var(--studio-accent)]">
            <Mail className="size-6" />
          </div>
          <h1
            style={{ fontFamily: displayFontFamily }}
            className="text-xl font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
          >
            Check your email
          </h1>
          <p className="text-sm text-[var(--studio-ink-soft)] leading-relaxed">
            We sent a password setup link to <strong className="text-[var(--studio-ink)] font-semibold">{step1State.email}</strong>.
            Click the link to set your password and access your Studio dashboard.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-[var(--studio-accent)] hover:underline"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Password Mode Form
  if (isPasswordMode) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-[var(--studio-ink)]">
          <MapAppMark iconSize={26} className="text-lg" />
        </div>
        <form
          action={step2Action}
          className={`space-y-5 rounded-2xl bg-[var(--studio-surface)] p-8 ${CARD_SHADOW}`}
        >
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--studio-ink-soft)] uppercase">
              Partner Studio
            </p>
            <h1
              style={{ fontFamily: displayFontFamily }}
              className="mt-1 text-xl font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
            >
              Enter your password
            </h1>
            <p className="mt-1 text-sm text-[var(--studio-ink-soft)] truncate">
              Signing in as <span className="font-semibold text-[var(--studio-ink)]">{activeEmail}</span>
            </p>
          </div>

          <input type="hidden" name="email" value={activeEmail} />

          <label className={labelClass}>
            Password
            <div className="relative mt-1">
              <input
                name="password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
          </label>

          {activeError ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
              {activeError}
            </div>
          ) : null}

          <PrimaryButton type="submit" disabled={isPending} className="w-full">
            {isPending ? "Signing in…" : "Sign in"}
          </PrimaryButton>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setResettingEmail(true);
              }}
              className="inline-flex items-center gap-1 text-[var(--studio-ink-soft)] hover:text-[var(--studio-ink)]"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(activeEmail)}&portal=studio`}
              className="font-semibold text-[var(--studio-accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    );
  }

  // Step 1: Email Form
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center text-[var(--studio-ink)]">
        <MapAppMark iconSize={26} className="text-lg" />
      </div>
      <form
        action={(formData) => {
          setResettingEmail(false);
          setLocalEmail(String(formData.get("email") || ""));
          step1Action(formData);
        }}
        className={`space-y-5 rounded-2xl bg-[var(--studio-surface)] p-8 ${CARD_SHADOW}`}
      >
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--studio-ink-soft)] uppercase">
            Partner Studio
          </p>
          <h1
            style={{ fontFamily: displayFontFamily }}
            className="mt-1 text-xl font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
          >
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--studio-ink-soft)]">
            Enter your email address to continue to your dashboard.
          </p>
        </div>

        <label className={labelClass}>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue={activeEmail}
            placeholder="you@company.com"
            className={inputClass}
          />
        </label>

        {activeError ? (
          <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {activeError}
          </div>
        ) : null}

        <PrimaryButton type="submit" disabled={isPending} className="w-full">
          {isPending ? "Continuing…" : "Continue with email"}
        </PrimaryButton>
      </form>
    </div>
  );
}
