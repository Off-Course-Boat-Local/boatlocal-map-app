// Admin's platform-default settings page.
//
// Manages the default platform branding and recommendations for BoatLocal —
// shown to a guest who opens the app with no `?company=` link at all.
//
// Managed via BrandingForm and RecommendationsManager tabs.

import type { Metadata } from "next";

import "@/app/studio/studio-theme.css";
import DefaultCompanyTabs from "@/components/admin/DefaultCompanyTabs";
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
import { getPlatformDefaultCompany, getRecommendationsForStudio } from "@/lib/data/source";
import type { Brand } from "@/lib/types";

export const metadata: Metadata = { title: "Default settings" };

const DEFAULT_BOATLOCAL_BRAND: Brand = {
  id: "boatlocal-default",
  companyName: "Boat Local",
  appName: "BoatLocal Map App",
  primary: "#1B5FE3",
  primaryDark: "#14449E",
  accent: "#FF7A45",
  surround: "#F6F6F3",
};

export default async function AdminDefaultSettingsPage() {
  const flagged = await getPlatformDefaultCompany();
  const allRecommendations = await getRecommendationsForStudio(ADMIN_ACTOR);

  const companyId = flagged?.id ?? "31b06609-8f84-4a36-b921-7630b5739719";
  const recommendations = allRecommendations.filter(
    (r) => r.companyId === companyId && r.ownerType === "company",
  );

  const initialBrand: Brand = flagged
    ? {
        id: flagged.id,
        companyName: flagged.name,
        appName: flagged.appName,
        primary: flagged.brandPrimary,
        primaryDark: flagged.brandPrimaryDark,
        accent: flagged.brandAccent,
        surround: flagged.brandSurround,
      }
    : DEFAULT_BOATLOCAL_BRAND;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[var(--admin-ink)]">
          Default settings
        </h1>
        <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
          Manage the default platform branding and 12 recommendations for <strong>BoatLocal</strong> (displayed to guests visiting without a specific company parameter).
        </p>
      </div>

      <div className="studio-root">
        <DefaultCompanyTabs
          recommendationsCount={recommendations.length}
          brandingContent={
            <StudioPreviewProvider initialBrand={initialBrand} initialLogoUrl={flagged?.logoUrl ?? null}>
              <BrandingForm
                companyId={companyId}
                initialBrand={initialBrand}
                initialLogoUrl={flagged?.logoUrl ?? null}
                saveAction={saveDefaultCompanyBrandingAction}
              />
            </StudioPreviewProvider>
          }
          recommendationsContent={
            <RecommendationsManager
              recommendations={recommendations}
              role="company"
              deleteAction={deleteDefaultCompanyRecommendationAction}
              setVisibilityAction={setDefaultCompanyRecommendationVisibilityAction}
              saveAction={saveDefaultCompanyRecommendationAction.bind(null, companyId)}
            />
          }
        />
      </div>
    </div>
  );
}
