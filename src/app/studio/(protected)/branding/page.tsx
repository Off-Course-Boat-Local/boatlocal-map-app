// Branding — company only. Logo upload, primary + accent colour, app name,
// and welcome copy, with a live preview wired through StudioPreviewContext
// (see BrandingForm.tsx's header comment for the persistence split).

import BrandingForm from "@/components/studio/BrandingForm";
import { getCompanyForStudio } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";
import type { Brand } from "@/lib/types";

export default async function StudioBrandingPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const company = await getCompanyForStudio(actor, session.companyId);

  if (!company) {
    return <p className="text-sm font-medium text-red-600">Company record not found.</p>;
  }

  const initialBrand: Brand = {
    id: company.id,
    companyName: company.name,
    appName: company.appName,
    primary: company.brandPrimary,
    primaryDark: company.brandPrimaryDark,
    accent: company.brandAccent,
    surround: company.brandSurround,
    logoUrl: company.logoUrl,
  };

  return (
    <BrandingForm
      companyId={company.id}
      initialBrand={initialBrand}
      initialLogoUrl={company.logoUrl}
      initialGoogleReviewUrl={company.googleReviewUrl}
      initialTripadvisorReviewUrl={company.tripadvisorReviewUrl}
      initialReviewPlatform={company.reviewPlatform}
    />
  );
}
