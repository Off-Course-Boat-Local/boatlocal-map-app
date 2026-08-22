import type { ReactNode } from "react";

// Studio's authenticated shell: sidebar (role-gated nav) + page content,
// plus the guest preview in whichever form the role gets — docked panel for
// a company, sidebar-button slide-over for a guide (see
// PhonePreviewPanel.tsx's header for why they differ).
// One layout for both "company" and "guide" roles —
// Studio is one back office, not two apps — with the role split happening
// inside navForRole() and again at the top of every company-only /
// guide-only page (defence in depth, per the routing research notes: a
// layout can be skipped on a soft navigation within the same segment tree,
// so it is never the *only* check).
//
// Lives under the `(protected)` route group (doesn't affect the URL —
// /studio, /studio/branding etc. are unchanged) so that this guard does NOT
// wrap `src/app/studio/login/page.tsx`. It originally sat directly at
// `src/app/studio/layout.tsx`, covering every route under studio/ including
// login — which meant an unauthenticated visit to /studio/login called
// requireDevSession() below, which redirects to /studio/login, which hits
// this same layout again: an infinite redirect loop that made Studio
// completely unreachable. Caught by an actual browser login attempt, not by
// tsc/eslint/vitest/build, none of which exercise a request's redirect
// chain. Mirrors how src/app/admin/(protected)/ already avoided this.
import StudioPreviewRail from "@/components/studio/StudioPreviewRail";
import { StudioPreviewProvider } from "@/components/studio/StudioPreviewContext";
import StudioSidebar from "@/components/studio/StudioSidebar";
import { getCompanyForStudio, getMapPins } from "@/lib/data/source";
import { navForRole } from "@/lib/studio/nav";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";
import { DEFAULT_BRAND } from "@/lib/brand";
import type { Brand } from "@/lib/types";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const [company, pins] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getMapPins(session.companyId),
  ]);

  // The live preview needs *a* brand to render even if the company row is
  // somehow missing (should not happen once the fake store is seeded, but
  // this is dev-only scaffolding, so fail soft rather than 500).
  const brand: Brand = company
    ? {
        id: company.subdomain,
        companyName: company.name,
        appName: company.appName,
        primary: company.brandPrimary,
        primaryDark: company.brandPrimaryDark,
        accent: company.brandAccent,
        surround: company.brandSurround,
      }
    : DEFAULT_BRAND;

  const subtitle =
    session.role === "guide"
      ? `${pins.length} picks curated by ${session.guideName}`
      : `${pins.length} picks across ${session.companyName}`;

  const navItems = navForRole(session.role);
  const roleLabel = session.role === "guide" ? "Guide" : "Company";
  const name = session.role === "guide" ? session.guideName : session.companyName;
  const isGuide = session.role === "guide";

  return (
    <StudioPreviewProvider initialBrand={brand} initialLogoUrl={company?.logoUrl ?? null}>
      <div className="flex h-dvh w-full overflow-hidden bg-neutral-100 text-neutral-900">
        <StudioSidebar items={navItems} roleLabel={roleLabel} name={name} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
        {isGuide ? null : <StudioPreviewRail pins={pins} subtitle={subtitle} />}
      </div>
    </StudioPreviewProvider>
  );
}
