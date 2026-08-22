"use client";

// The preview page's phone — an iframe running the REAL guest app, not a
// mock of it.
//
// WHY AN IFRAME rather than rendering the guest components inline (which is
// what PhonePreview.tsx does for the docked branding panel): this preview
// exists to be clicked through. Tapping a pin, opening a place, switching
// tabs, hitting "Book this tour" — all of it has to behave exactly as it
// does for a guest, and the only way to guarantee that is to load the same
// routes over HTTP rather than re-mount a subset of the screens here and
// hope the two stay in step. PhonePreview stays as it is: it answers "do my
// colours look right" live while editing, which an iframe cannot do without
// a round trip per keystroke. Two different jobs.
//
// The src carries `?preview=1`, which src/proxy.ts turns into a request
// header plus a session cookie so nothing done in here reaches analytics —
// see src/lib/guestPreview.ts. That is the whole contract: a preview is not
// a visit, a tap in here is not a click, and none of this shows up in the
// numbers on the Dashboard or Report.
//
// The iframe is sized to a real phone viewport (390px), which is below
// PhoneFrame's `md` breakpoint — so the guest app inside renders full-bleed
// exactly as it does on a handset, and the bezel drawn here is Studio's
// chrome around it rather than two nested phone frames.

import { useRef, useState } from "react";

import PortalSelect from "@/components/PortalSelect";

export interface PreviewTarget {
  /** Stable key for the <select>. */
  value: string;
  label: string;
  url: string;
}

export interface GuestPreviewFrameProps {
  targets: PreviewTarget[];
}

export default function GuestPreviewFrame({ targets }: GuestPreviewFrameProps) {
  const [selected, setSelected] = useState(targets[0]?.value ?? "");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const target = targets.find((t) => t.value === selected) ?? targets[0];

  function reload() {
    const frame = frameRef.current;
    if (!frame) return;
    // Same-origin, so this is reachable — and unlike bumping a cache-busting
    // query param it doesn't rewrite the URL the previewer is looking at.
    frame.contentWindow?.location.reload();
  }

  if (!target) {
    return (
      <p className="text-sm text-neutral-500">
        There is nothing to preview yet — this company has no live link.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {targets.length > 1 ? (
          <div className="w-full sm:w-72">
            <PortalSelect
              name="preview-target"
              options={targets.map((t) => ({ value: t.value, label: t.label }))}
              defaultValue={selected}
              onValueChange={setSelected}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={reload}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          Reload
        </button>

        <a
          href={target.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          Open in a new tab
        </a>
      </div>

      <div className="flex justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <div className="relative h-[780px] w-[390px] shrink-0 overflow-hidden rounded-[2.25rem] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] ring-[10px] ring-neutral-900">
          <iframe
            ref={frameRef}
            key={target.value}
            src={target.url}
            title={`Guest app preview — ${target.label}`}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
