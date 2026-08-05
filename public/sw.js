// Boat Local Map App — minimal guest-app service worker (PRD §5.7's
// offline/install story). Hand-written rather than a library (Serwist etc.)
// — none is installed today and adding a new dependency wasn't part of this
// task; this file is short enough to stay readable without one.
//
// Registered only for guest routes, only in production, from
// src/components/ServiceWorkerRegister.tsx (mounted once in
// src/app/(guest)/layout.tsx). Never registered for /studio or /admin — an
// offline back office that silently serves stale data would be actively
// dangerous, not a nice-to-have.
//
// ============================================================================
// WHAT IS CACHED
// ============================================================================
// 1. App shell precache (installed up front): the manifest and this app's
//    placeholder icons — small, static, safe to fetch unconditionally.
// 2. Guest page navigations (runtime, network-first): every same-origin
//    navigation to a guest route (/, /map, /list, /saved, /review,
//    /install) is tried on the network first; a successful response
//    refreshes the cache, and the LAST successfully loaded copy is served
//    from cache when the network fails. Because these pages are rendered
//    server-side with the guide's actual recommendations baked into the
//    HTML (there is no separate "tip data" JSON endpoint yet — see
//    src/lib/data/source.ts), caching the page IS caching the guide's tip
//    data for offline use: a guest who loaded /map once can reopen it with
//    no signal and still see the same pins, notes and photos-by-URL they
//    saw last time. It will not reflect anything the guide changed since
//    that last successful load.
// 3. Next.js static assets (runtime, cache-first): requests under
//    /_next/static/ are content-hashed and immutable by construction, so
//    they're served from cache first and only fetched once.
//
// ============================================================================
// WHAT IS NOT CACHED (on purpose)
// ============================================================================
// - Photos (picsum.photos placeholder URLs today, guide-uploaded storage
//   URLs later) are cross-origin and left to the browser's own HTTP cache —
//   caching arbitrary-sized guide photos ourselves risks filling a phone's
//   storage quota for a feature ("look at this offline") nobody asked for.
// - Anything under /api/ (in particular the boatlocal.nl booking webhook,
//   src/app/api/webhooks/boatlocal-booking) — a signed, one-shot inbound
//   webhook must never be served from cache.
// - Non-GET requests (POST/PUT/etc.) are always passed straight to the
//   network, never cached, never queued — this is deliberately NOT a
//   background-sync implementation.
// - Live geolocation, the MapLibre/OpenFreeMap vector tiles, and the
//   boatlocal.nl booking hand-off itself all still require a live network
//   connection; none of that is or should be faked offline.
// - /studio and /admin are excluded at the registration site
//   (ServiceWorkerRegister.tsx only mounts in the guest layout), so this
//   worker never even sees a request for either.

const CACHE_VERSION = "v1";
const CACHE_NAME = `boatlocal-guest-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // A precache failure (e.g. offline on first install) must not stop
      // the worker from activating — the runtime caching below still works.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isNextStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

/** Same-origin, GET, not an API route — the only requests this worker ever caches. */
function isCacheable(request, url) {
  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    !isApiRequest(url)
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheable(request, url)) return; // let the browser handle it normally

  if (isNextStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
