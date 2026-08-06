// Generic landing page for a failed/expired sign-in link, reached only from
// src/app/auth/confirm/route.ts. Deliberately unbranded (no Studio/Admin
// chrome) since a stale link's `next` target — and therefore which app it
// was headed to — isn't reliably known once verification has already
// failed.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign-in link expired — Boat Local",
};

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Link expired or already used</h1>
        <p className="mt-2 text-sm text-neutral-600">
          That sign-in link is no longer valid. Ask for a new one and try again.
        </p>
      </div>
    </main>
  );
}
