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
  devSignInAsAdminAction,
  type AdminLoginState,
} from "@/app/admin/login/actions";
import { FIELD_CLASS, FIELD_LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";

const CARD_CLASS =
  "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-[var(--admin-shadow-card)]";

function emptyState(): AdminLoginState {
  return {};
}

/**
 * Localhost-only "sign in as developer" button — see
 * src/lib/admin/devBypass.ts's header for what this actually does (a REAL
 * session, not a fake one) and why it's safe. `devEmail` is null in
 * production (AdminLoginPage never passes one), so this renders nothing
 * there — no separate check needed here.
 */
function DevSignInButton({ devEmail }: { devEmail: string | null }) {
  if (!devEmail) return null;
  return (
    <form action={devSignInAsAdminAction.bind(null, devEmail)} className="mt-4">
      <button
        type="submit"
        className="w-full rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
      >
        Dev: sign in as {devEmail}
      </button>
    </form>
  );
}

export default function AdminLoginForm({
  initialError,
  devEmail = null,
}: {
  initialError?: string;
  devEmail?: string | null;
}) {
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
      <div className={CARD_CLASS}>
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--admin-ink-soft)] uppercase">
          Admin
        </p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--admin-ink)]">Staff sign in</h1>
        <p
          role="status"
          className="mt-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3.5 py-2.5 text-sm text-[var(--admin-ink)]"
        >
          Check your email for a sign-in link.
        </p>
      </div>
    );
  }

  if (emailState.passwordMode) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--admin-ink-soft)] uppercase">
          Admin
        </p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--admin-ink)]">
          Enter your password
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
          Signing in as <span className="font-medium text-[var(--admin-ink)]">{emailState.email}</span>.
        </p>

        <form action={passwordFormAction} className="mt-6 space-y-4">
          <input type="hidden" name="email" value={emailState.email} />
          <div>
            <label htmlFor="password" className={FIELD_LABEL_CLASS}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className={`mt-1.5 ${FIELD_CLASS}`}
            />
          </div>

          {passwordState.error ? (
            <p role="alert" className="text-sm text-red-600">
              {passwordState.error}
            </p>
          ) : null}

          <button type="submit" disabled={passwordPending} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
            {passwordPending ? "Signing in…" : "Sign in"}
          </button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <a
              href="/admin/login"
              className="text-[var(--admin-ink-soft)] hover:underline"
            >
              Use different email
            </a>
            <a
              href={`/forgot-password?email=${encodeURIComponent(emailState.email || "")}&portal=admin`}
              className="font-medium text-[var(--admin-accent)] hover:underline"
            >
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--admin-ink-soft)] uppercase">
        Admin
      </p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--admin-ink)]">Staff sign in</h1>
      <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
        Enter your Map App staff email. Admin access is invite-only — there is no self-serve
        sign-up.
      </p>

      <form action={emailFormAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className={FIELD_LABEL_CLASS}>
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
            className={`mt-1.5 ${FIELD_CLASS}`}
          />
        </div>

        {emailState.error ? (
          <p role="alert" className="text-sm text-red-600">
            {emailState.error}
          </p>
        ) : null}

        <button type="submit" disabled={emailPending} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
          {emailPending ? "Continuing…" : "Continue"}
        </button>
      </form>

      <DevSignInButton devEmail={devEmail} />
    </div>
  );
}
