"use client";

// LOCALHOST-ONLY. Only ever rendered when the server-side NODE_ENV check in
// src/app/layout.tsx passes (production never even fetches the `companies`
// prop this needs) — see devSwitch.ts's header comment for the full
// rationale and safety gating.

import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";

import { devEnterCompanyStudioAction } from "@/lib/studio/devSwitchActions";
import type { DevSwitchCompany } from "@/lib/studio/devSwitch";

export default function DevCompanySwitcher({ companies }: { companies: DevSwitchCompany[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function enter(companyId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await devEnterCompanyStudioAction(companyId);
      } catch (err) {
        // redirect() throws internally on success — only a real failure lands here.
        if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
          setError(err.message);
        }
      }
    });
  }

  return (
    <div className="fixed right-4 bottom-4 z-[9999]">
      {open ? (
        <div className="mb-2 w-72 overflow-hidden rounded-2xl border-2 border-dashed border-amber-500 bg-white shadow-xl dark:bg-neutral-900">
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
            <p className="text-[0.6875rem] font-bold tracking-[0.1em] text-amber-800 uppercase dark:text-amber-300">
              Dev: enter a Studio
            </p>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter companies…"
              className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 dark:bg-neutral-800"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-neutral-500">No companies match.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={pending}
                  onClick={() => enter(c.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950/30"
                >
                  <span className="truncate">{c.name}</span>
                  {!c.hasOwner && (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[0.625rem] text-neutral-500 dark:bg-neutral-800">
                      unclaimed
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {error ? (
            <p className="border-t border-amber-200 px-3 py-2 text-xs text-red-600">{error}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-lg hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"
      >
        <Wrench className="size-4" />
        {pending ? "Entering…" : "Enter a Studio"}
      </button>
    </div>
  );
}
