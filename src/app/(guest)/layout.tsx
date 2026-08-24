// Root layout for every guest-facing screen (Map, List, Saved, Review,
// Install). A route GROUP — `(guest)` — rather than a real `/guest` segment,
// so these routes live at the site root (`/map`, `/list`, …) with their own
// shared shell, without it leaking into src/app/studio or src/app/admin.
//
// Owns, once, for every guest page:
//   - brand resolution (via src/lib/guestServerContext.ts, which reads the
//     { brandId, guideSlug } src/proxy.ts already attached as headers) and
//     publishing it as the --brand-* CSS custom properties every component
//     reads from (src/lib/brand.ts's brandCssVars) — server-side, so there
//     is no flash of unbranded content.
//   - the phone-shaped chrome (src/components/PhoneFrame.tsx — reused
//     as-is, not rebuilt).
//   - the bottom nav (src/components/guest/GuestBottomNav.tsx), shown under
//     every guest page's content.
//   - a per-tenant `<link rel="manifest">` href (see generateMetadata below)
//     — REGRESSION FIX, 2026-08-24: every guest, regardless of which
//     company/guide link they actually opened, was installing a PWA named
//     "Jan's Amsterdam". src/app/manifest.ts's own header comment used to
//     call this an unfixable "inherent limitation" — the browser's manifest
//     fetch doesn't carry the PAGE's query string, so it always fell back to
//     DEFAULT_BRAND (the "coastal" demo brand, appName "Jan's Amsterdam").
//     That reasoning missed that the *link itself* can carry query params:
//     Next's per-route generateMetadata can point `manifest` at
//     `/manifest.webmanifest?company=…&guide=…`, and src/proxy.ts's matcher
//     already covers that path, so the exact same resolveGuestBrand()
//     algorithm resolves the real tenant for the manifest fetch too. This
//     affects every real white-label client's home-screen install, not just
//     the demo — see manifest.ts for the other half of this fix.

import { Suspense, type CSSProperties, type ReactNode } from "react";
import type { Metadata } from "next";

import PhoneFrame from "@/components/PhoneFrame";
import ShareQr from "@/components/ShareQr";
import GuestAppOpenTracker from "@/components/guest/GuestAppOpenTracker";
import GuestBottomNav from "@/components/guest/GuestBottomNav";
import ServiceWorkerRegister from "@/components/guest/ServiceWorkerRegister";
import { brandCssVars } from "@/lib/brand";
import { GuestFilterProvider } from "@/lib/guestFilterContext";
import { getGuestContext } from "@/lib/guestServerContext";
import { isPreviewRequest } from "@/lib/guestPreview";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { brandId, guideSlug } = await getGuestContext();
  const params = new URLSearchParams({ company: brandId, guide: guideSlug });
  return { manifest: `/manifest.webmanifest?${params.toString()}` };
}

export default async function GuestLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { brand, companyId, guide } = await getGuestContext();
  const isPreview = await isPreviewRequest();
  // Locale = the guest's map_app_lang cookie if set, otherwise their
  // browser's Accept-Language, otherwise English — see src/lib/i18n.
  // Guest app only: Studio/Admin never touch this.
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    // `lang` on the guest shell (the root <html> is shared with
    // Studio/Admin, which stay English — so the attribute lives here, on
    // the outermost element this layout owns).
    <main lang={locale} style={brandCssVars(brand) as CSSProperties}>
      {/* public/sw.js — see that file's header comment for exactly what it
          caches (the app shell + the last-loaded guide tip data) and what it
          deliberately doesn't. Guest routes only: never mounted under
          /studio or /admin.

          Skipped in Studio's preview: the worker would install itself for
          this whole origin and start serving its cached shell to the real
          guest app in the same browser, so a company admin clicking around
          the preview would quietly change what they see at their own live
          link afterwards. A preview must not leave anything behind. */}
      {isPreview ? null : <ServiceWorkerRegister />}
      {/* Records one "app_open" event per browser tab session — same
          preview exclusion as the service worker above, for the same
          reason (a company/guide clicking around their own preview must
          never inflate their own tenant's real traffic numbers). See
          GuestAppOpenTracker's header comment for why this layout, not a
          per-screen component, is the right mount point. */}
      {isPreview ? null : <GuestAppOpenTracker companyId={companyId} guideId={guide?.id ?? null} />}
      <PhoneFrame
        aside={
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {brand.companyName}
            </p>
            <h1
              className="text-3xl leading-tight text-neutral-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {brand.appName}
            </h1>
            <p className="text-sm leading-relaxed text-neutral-600">
              {dict.common.scanAside}
            </p>
            <ShareQr />
          </div>
        }
      >
        {/* Locale context for every guest client component (useI18n).
            Only the locale STRING crosses the RSC boundary — the provider
            picks its own dictionary (see LocaleProvider's header comment).
            The LanguageSwitcher writes the cookie + router.refresh(), which
            re-runs this layout and re-mounts the provider with the new
            locale. */}
        <LocaleProvider locale={locale}>
        {/* Shared across every guest route (Map, List, ...) for as long as
            this layout instance stays mounted, i.e. across client-side
            navigation between them — see src/lib/guestFilterContext.tsx for
            why this is the "easy" way to keep the category filter in sync
            between the Map and List screens without a new persistence layer. */}
        <GuestFilterProvider>
          <div className="flex h-full w-full flex-col">
            <div className="min-h-0 flex-1">{children}</div>
            {/* useSearchParams (inside GuestBottomNav, to carry ?company=/?guide=
                across tabs) requires a Suspense boundary — see Next.js docs on
                useSearchParams and static bail-out. */}
            <Suspense fallback={null}>
              <GuestBottomNav />
            </Suspense>
          </div>
        </GuestFilterProvider>
        </LocaleProvider>
      </PhoneFrame>
    </main>
  );
}
