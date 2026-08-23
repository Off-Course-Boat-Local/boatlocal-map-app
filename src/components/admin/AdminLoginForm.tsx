"use client";

// Admin sign-in, email-first with progressive disclosure of a password
// field — see src/app/admin/login/actions.ts for the two server actions
// this drives and the anti-enumeration property behind the "magic-link"
// branch.
//
// Two independent useActionState hooks, one per step, rather than one
// shared piece of state: only one form is ever rendered/posted to at a
// time (email step, XOR password step), so there is nothing to merge —
// which form is currently showing is derived from emailState alone.

import { useActionState } from "react";

import {
  checkAdminLoginMethodAction,
  signInAdminWithPasswordAction,
  type AdminLoginState,
} from "@/app/admin/login/actions";

function emptyState(): AdminLoginState {
  return {};
}

export default function AdminLoginForm({ initialError }: { initialError?: string }) {
  const [emailState, emailFormAction, emailPending] = useActionState(
    checkAdminLoginMethodAction,
    initialError ? { error: initialError } : emptyState(),
  );
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    signInAdminWithPasswordAction,
    emptyState(),
  );

  if (emailState.sent) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Staff sign in</h1>
        <p
          role="status"
          className="mt-6 rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-ink)]"
        >
          Check your email for a sign-in link.
        </p>
      </div>
    );
  }

  if (emailState.passwordMode) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Enter your password</h1>
        <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
          Signing in as <span className="font-medium text-[var(--admin-ink)]">{emailState.email}</span>.
        </p>

        <form action={passwordFormAction} className="mt-6 space-y-4">
          <input type="hidden" name="email" value={emailState.email} />
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--admin-ink)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
            />
          </div>

          {passwordState.error ? (
            <p role="alert" className="text-sm text-red-600">
              {passwordState.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={passwordPending}
            className="w-full rounded-md bg-[var(--admin-accent-strong)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {passwordPending ? "Signing in…" : "Sign in"}
          </button>

          <a
            href="/admin/login"
            className="block text-center text-xs text-[var(--admin-ink-soft)] underline underline-offset-2"
          >
            Not you? Use a different email
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
        Admin
      </p>
      <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Staff sign in</h1>
      <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
        Enter your Map App staff email. Admin access is invite-only — there is no self-serve
        sign-up.
      </p>

      <form action={emailFormAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--admin-ink)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            defaultValue={emailState.email}
            className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
          />
        </div>

        {emailState.error ? (
          <p role="alert" className="text-sm text-red-600">
            {emailState.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={emailPending}
          className="w-full rounded-md bg-[var(--admin-accent-strong)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {emailPending ? "Continuing…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
