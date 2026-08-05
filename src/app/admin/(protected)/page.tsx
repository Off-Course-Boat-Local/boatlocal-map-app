import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { mockPlatformEffectiveness } from "@/lib/admin/mockAnalytics";
import {
  getGuidesForCompany,
  getPlatformAnalyticsSummary,
  listBoatTourCatalog,
  listCompanies,
} from "@/lib/data/source";
import type { CompanyStatus } from "@/lib/data/types";
import AdminTable from "@/components/admin/AdminTable";
import StatCard from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Overview" };

// How many companies to show inline before pointing to the full list —
// keeps this page a snapshot, not a second copy of /admin/companies.
const COMPANY_PREVIEW_LIMIT = 8;

// Matches src/app/admin/(protected)/companies/page.tsx's own STATUS_LABEL /
// STATUS_TONE exactly, so a company reads the same "Setup / Live /
// Suspended" whichever of the two pages it's seen on.
const STATUS_LABEL: Record<CompanyStatus, string> = {
  setup: "Setup",
  active: "Live",
  suspended: "Suspended",
};

const STATUS_TONE: Record<CompanyStatus, "positive" | "neutral" | "warning"> = {
  setup: "neutral",
  active: "positive",
  suspended: "warning",
};

export default async function AdminOverviewPage() {
  const [companies, boatTours, analytics] = await Promise.all([
    listCompanies(ADMIN_ACTOR),
    listBoatTourCatalog(ADMIN_ACTOR),
    getPlatformAnalyticsSummary(ADMIN_ACTOR),
  ]);

  const guidesPerCompany = await Promise.all(
    companies.map((company) => getGuidesForCompany(ADMIN_ACTOR, company.id)),
  );
  const totalGuides = guidesPerCompany.reduce((sum, guides) => sum + guides.length, 0);
  const activeGuides = guidesPerCompany.reduce(
    (sum, guides) => sum + guides.filter((g) => g.status === "active").length,
    0,
  );

  // "setup vs live" (PRD §2.3) is `company.status`: "setup" is a brand-new,
  // not-yet-guest-visible tenant; "active" is what PRD prose calls "live";
  // "suspended" is an admin-disabled tenant — see the CompanyStatus comment
  // in src/lib/data/types.ts for why "setup" was added on top of the
  // originally handed-off schema, mirroring how GuideStatus gained "invited".
  const liveCompanies = companies.filter((c) => c.status === "active").length;
  const setupCompanies = companies.filter((c) => c.status === "setup").length;
  const suspendedCompanies = companies.filter((c) => c.status === "suspended").length;
  const activeBoatTours = boatTours.filter((t) => t.status === "active").length;
  const totalEvents = analytics.reduce((sum, row) => sum + row.count, 0);

  // PRD §2.3 "effectiveness dashboard" — MOCK numbers (see
  // src/lib/admin/mockAnalytics.ts's header comment: fakeStore seeds zero
  // rows into `events`, so a real rollup would read 0 for every metric here
  // today). Fixed seed for a stable "all companies, all time" snapshot; the
  // filterable, per-company/date-range breakdown lives on Admin > Platform
  // analytics, which uses the same mock module.
  const effectiveness = mockPlatformEffectiveness("platform::overview::all");

  const companyPreview = companies.slice(0, COMPANY_PREVIEW_LIMIT);
  const hiddenCompanyCount = companies.length - companyPreview.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
          Platform-wide snapshot across every tenant — PRD §8.1.
        </p>
      </div>

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Companies"
            value={companies.length}
            hint={`${liveCompanies} live · ${setupCompanies} in setup${
              suspendedCompanies ? ` · ${suspendedCompanies} suspended` : ""
            }`}
          />
          <StatCard label="Guides" value={totalGuides} hint={`${activeGuides} active`} />
          <StatCard
            label="Boat tours"
            value={boatTours.length}
            hint={`${activeBoatTours} active`}
          />
          <StatCard label="Tracked events" value={totalEvents} hint="Real, all time" />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--admin-ink)]">
            Effectiveness (PRD §2.3)
          </h2>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            Placeholder data — no live analytics pipeline yet
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
          How well the app drives bookings and reviews across the whole platform. See{" "}
          <Link href="/admin/analytics" className="underline-offset-2 hover:underline">
            Platform analytics
          </Link>{" "}
          for the filterable, per-company / date-range breakdown.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {effectiveness.map((metric) => (
            <StatCard
              key={metric.key}
              label={metric.label}
              value={metric.unit ? `${metric.value}${metric.unit}` : metric.value}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-ink)]">Companies</h2>
            <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
              {companies.length} tenant{companies.length === 1 ? "" : "s"} — {liveCompanies} live,{" "}
              {setupCompanies} in setup
              {suspendedCompanies ? `, ${suspendedCompanies} suspended` : ""}.
            </p>
          </div>
          <Link
            href="/admin/companies"
            className="text-sm font-medium text-[var(--admin-accent-strong)] underline-offset-2 hover:underline"
          >
            View all companies →
          </Link>
        </div>

        <AdminTable
          className="mt-4"
          columns={["Company", "Subdomain", "Type", "Status"]}
          rows={companyPreview.map((company) => [
            company.name,
            company.subdomain,
            company.companyType,
            <StatusBadge
              key="status"
              status={STATUS_LABEL[company.status]}
              tone={STATUS_TONE[company.status]}
            />,
          ])}
          emptyMessage="No companies yet — onboard the first one below."
        />
        {hiddenCompanyCount > 0 ? (
          <p className="mt-2 text-xs text-[var(--admin-ink-soft)]">
            +{hiddenCompanyCount} more on the{" "}
            <Link href="/admin/companies" className="underline-offset-2 hover:underline">
              full companies list
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--admin-ink)]">Onboard a company</h2>
          <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
            Assigns a subdomain — validated for URL-safety and checked against every existing
            tenant (PRD §8.1 / §13.1). New companies start in &ldquo;Setup&rdquo; status until an
            admin takes them live.
          </p>
        </div>
        {/* The onboarding form itself lives on the Companies page
            (src/components/admin/CreateCompanyForm.tsx), next to the status
            actions (Go live / Suspend / Reactivate) a company needs right
            after being created — this is the entry point PRD §8.1 asks
            Overview to provide, not a second copy of the form. */}
        <Link
          href="/admin/companies"
          className="shrink-0 rounded-md bg-[var(--admin-accent-strong)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Onboard a company →
        </Link>
      </section>
    </div>
  );
}
