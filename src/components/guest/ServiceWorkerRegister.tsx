"use client";

// Registers public/sw.js (see that file's header comment for exactly what
// it does and doesn't cache). Mounted once, in src/app/(guest)/layout.tsx
// only — never in Studio or Admin's layouts, so an offline back office
// serving stale tenant data is never even possible.
//
// Skipped outside production: a caching service worker fighting Next's dev
// server (fast refresh, on-demand compilation) produces confusing "why is
// my change not showing up" bugs that have nothing to do with this feature.
// Renders nothing — this is a side-effect-only component.

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: a guest with a working, un-cached app is still fine.
    });
  }, []);

  return null;
}
