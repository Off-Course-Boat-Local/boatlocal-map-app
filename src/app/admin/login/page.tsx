import type { Metadata } from "next";

import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const hasError = (Array.isArray(params.error) ? params.error[0] : params.error) === "1";

  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-[var(--admin-bg)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase">
          Boat Local
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">Staff sign in</h1>
        <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
          Dev-only stand-in: any email, plus the shared dev password.
        </p>

        <form action={login} className="mt-6 space-y-4">
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
              className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--admin-ink)]">
              Dev password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
            />
          </div>

          {hasError ? (
            <p role="alert" className="text-sm text-red-600">
              Wrong email or dev password.
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--admin-accent-strong)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-xs text-[var(--admin-ink-soft)]">
          DEV AUTH STAND-IN — no real backend exists yet. See
          src/lib/admin/devAuth.ts.
        </p>
      </div>
    </div>
  );
}
