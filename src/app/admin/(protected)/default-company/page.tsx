// Admin's platform-default-company page (the fix for the bug where a guest
// with no `?company=` at all landed on src/lib/brand.ts's hardcoded,
// prototype-era BRANDS.coastal — see src/lib/guestServerContext.ts's own
// header comment for the full story). The platform default is a normal row
// in `companies`, just flagged via `is_platform_default`
// (supabase/migrations/20260823190000_platform_default_company.sql) —
// managed here with the EXACT SAME Branding/Recommendations editors Studio
// uses for any other tenant (BrandingForm, RecommendationsManager), not a
// second content-management UI. The only thing genuinely new here is the
// session/actor plumbing (src/lib/admin/defaultCompanyActions.ts) that lets
// an Admin session drive those same components instead of a Studio "company"
// dev session.
//
// Two states:
//   - nothing flagged yet (fresh install) -> DefaultCompanyPicker, an
//     existing-company dropdown (see that component's own doc comment for
//     why "pick an existing company" beats a second "create a company" form
//     here).
//   - a company IS flagged -> DefaultCompanyHeader (switch/unset) plus the
//     reused Branding + Recommendations editors, scoped to that company.

import type { Metadata } from "next";

// This page is the one place outside src/app/studio/ that renders Studio's
// own components (BrandingForm, RecommendationsManager) — see the
// `.studio-root` wrapper further down for why. Next.js only includes a CSS
// import in a route's compiled stylesheet when something in that route's
// own tree actually imports it — Studio's protected layout importing this
// file does nothing for a request that never enters src/app/studio/, so it
// has to be imported again, right here, or `.studio-root`'s custom
// properties don't exist on this page at all.
import "@/app/studio/studio-theme.css";
import DefaultCompanyHeader from "@/components/admin/DefaultCompanyHeader";
import DefaultCompanyPicker from "@/components/admin/DefaultCompanyPicker";
import BrandingForm from "@/components/studio/BrandingForm";
import { StudioPreviewProvider } from "@/components/studio/StudioPreviewContext";
import RecommendationsManager from "@/components/studio/RecommendationsManager";
import { ADMIN_ACTOR } from "@/lib/admin/actor";
import {
  deleteDefaultCompanyRecommendationAction,
  saveDefaultCompanyBrandingAction,
  saveDefaultCompanyRecommendationAction,
  setDefaultCompanyRecommendationVisibilityAction,
} from "@/lib/admin/defaultCompanyActions";
import { getPlatformDefaultCompany, getRecommendationsForStudio, listCompanies } from "@/lib/data/source";
import type { Brand } from "@/lib/types";

export const metadata: Metadata = { title: "Default company" };

export default async function AdminDefaultCompanyPage() {
  const flagged = await getPlatformDefaultCompany();

  if (!flagged) {
    const companies = await listCompanies(ADMIN_ACTOR);
    return (
      <div className="max-w-xl">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[var(--admin-ink)]">
          Default company
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">
          Shown to a guest who opens the app with no <code>?company=</code> link at all — e.g. the
          bare map.boatlocal.nl root. Nothing is flagged yet, so those guests currently see a
          plain, neutral &ldquo;Map App&rdquo; identity with no recommendations, rather than any
          one tenant&rsquo;s branding.
        </p>

        {companies.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--admin-ink-soft)]">
            Onboard a company first (Companies → Create company), then come back here to flag it
            as the default. The founder&rsquo;s intent is for this to represent Boat Local itself
            — the parent brand — rather than any individual partner, but any company can be
            flagged.
          </p>
        ) : (
          <DefaultCompanyPicker companies={companies} />
        )}
      </div>
    );
  }

  const [allCompanies, allRecommendations] = await Promise.all([
    listCompanies(ADMIN_ACTOR),
    // Admin sees every tenant's recommendations from this call (no
    // company_id filter for an admin actor — see getRecommendationsForStudio's
    // own comment in source.ts) — narrowed to this one company's own base
    // list below, exactly like src/app/studio/(protected)/recommendations/page.tsx
    // narrows for a "company" session.
    getRecommendationsForStudio(ADMIN_ACTOR),
  ]);
  const recommendations = allRecommendations.filter(
    (r) => r.companyId === flagged.id && r.ownerType === "company",
  );
  const otherCompanies = allCompanies.filter((c) => c.id !== flagged.id);

  const initialBrand: Brand = {
    id: flagged.id,
    companyName: flagged.name,
    appName: flagged.appName,
    primary: flagged.brandPrimary,
    primaryDark: flagged.brandPrimaryDark,
    accent: flagged.brandAccent,
    surround: flagged.brandSurround,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[var(--admin-ink)]">
          Default company
        </h1>
        <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
          Shown to a guest who opens the app with no <code>?company=</code> link at all.
        </p>
      </div>

      <DefaultCompanyHeader company={flagged} otherCompanies={otherCompanies} />

      {/* REGRESSION FIX (2026-08-24): BrandingForm/RecommendationsManager are
          Studio's own components, styled entirely through `var(--studio-*)`
          custom properties — but those properties are only ever DEFINED by
          the `.studio-root` class (src/app/studio/studio-theme.css), which
          Studio's own protected layout applies and this Admin page never
          did. Every `var(--studio-border)`/`var(--studio-surface)`/etc.
          reference inside these two components was silently resolving to
          nothing, so they rendered in bare browser-default styling — no
          radius, no shadow, no brand font — right below an otherwise fully
          restyled Admin page. `.studio-root` only SCOPES CSS custom
          properties (see that file's own header comment: "Mirrors
          admin-theme.css value-for-value" — it carries no layout rules of
          its own beyond the variables), so wrapping just these two
          components in it is enough to fix their styling without pulling
          in any of Studio's actual page-shell layout. */}
      <div className="studio-root space-y-8">
        {/* StudioPreviewProvider is the one bit of Studio plumbing BrandingForm
            genuinely can't run without (it calls useStudioPreview() on every
            field change) — see that context's own header comment. Admin has
            no phone-preview panel of its own; this just satisfies the
            context requirement so the form doesn't crash, nothing renders
            from it here. */}
        <StudioPreviewProvider initialBrand={initialBrand} initialLogoUrl={flagged.logoUrl}>
          <BrandingForm
            companyId={flagged.id}
            initialBrand={initialBrand}
            initialLogoUrl={flagged.logoUrl}
            saveAction={saveDefaultCompanyBrandingAction}
          />
        </StudioPreviewProvider>

        <RecommendationsManager
          recommendations={recommendations}
          role="company"
          deleteAction={deleteDefaultCompanyRecommendationAction}
          setVisibilityAction={setDefaultCompanyRecommendationVisibilityAction}
          saveAction={saveDefaultCompanyRecommendationAction.bind(null, flagged.id)}
        />
      </div>
    </div>
  );
}
