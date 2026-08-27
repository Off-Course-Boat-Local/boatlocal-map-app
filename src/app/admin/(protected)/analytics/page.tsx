import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { parseDateRangeParams } from "@/lib/admin/dateRange";
import { platformEffectiveness } from "@/lib/admin/analytics";
import {
  getBoatTours,
  getGuidesForCompany,
  getPlatformAnalyticsSummary,
  listBoatTourCatalog,
  listCompanies,
} from "@/lib/data/source";
import AdminTable from "@/components/admin/AdminTable";
import AnalyticsFilterBar from "@/components/admin/AnalyticsFilterBar";
import { Eyebrow, Panel, SectionHeading } from "@/components/admin/primitives";
import StatCard from "@/components/admin/StatCard";

export const metadata: Metadata = { title: "Platform analytics" };

type SearchParamValue = string | string[] | undefined;
type AnalyticsSearchParams = { company?: SearchParamValue; from?: SearchParamValue; to?: SearchParamValue };

/** Query params can arrive as string | string[] | undefined — normalize to one string or undefined. */
function firstParam(value: SearchParamValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const companyId = firstParam(params.company);
  const fromStr = firstParam(params.from);
  const toStr = firstParam(params.to);
  const range = parseDateRangeParams({ from: fromStr, to: toStr });

  const companies = await listCompanies(ADMIN_ACTOR);
  const selectedCompany = companyId ? companies.find((c) => c.id === companyId) : undefined;
  const scopedCompanies = selectedCompany ? [selectedCompany] : companies;

  // Same metric set as Overview's KPI row (Companies / Guides / Boat tours /
  // Tracked events — src/app/admin/(protected)/page.tsx), but here every one
  // of them actually responds to the company filter, and "Tracked events"
  // additionally responds to the date-range filter via the real
  // getPlatformAnalyticsSummary(range) call below.
  //
  // Boat tours are admin-owned and platform-wide, not company-owned (PRD
  // §8.2) — "in scope" for a selected company means "featured by that
  // company" (getBoatTours, the same read the guest map uses, which has no
  // `status` field since hidden tours are already excluded); otherwise it's
  // the whole admin catalog, which does carry `status`. Resolved as one
  // `{ count, hint }` pair up front so the JSX below never has to narrow a
  // BoatTourView | BoatTourRecord union.
  const [guidesPerScopedCompany, boatTours, analytics] = await Promise.all([
    Promise.all(scopedCompanies.map((company) => getGuidesForCompany(ADMIN_ACTOR, company.id))),
    selectedCompany
      ? getBoatTours(selectedCompany.id).then((tours) => ({
          count: tours.length,
          hint: "featured by this company",
        }))
      : listBoatTourCatalog(ADMIN_ACTOR).then((tours) => ({
          count: tours.length,
          hint: `${tours.filter((t) => t.status === "active").length} active`,
        })),
    getPlatformAnalyticsSummary(ADMIN_ACTOR, range),
  ]);

  const totalGuidesInScope = guidesPerScopedCompany.reduce((sum, g) => sum + g.length, 0);
  const scopedAnalytics = selectedCompany
    ? analytics.filter((row) => row.companyId === selectedCompany.id)
    : analytics;
  const totalEvents = scopedAnalytics.reduce((sum, row) => sum + row.count, 0);

  const totalsByType = new Map<string, number>();
  for (const row of scopedAnalytics) {
    totalsByType.set(row.eventType, (totalsByType.get(row.eventType) ?? 0) + row.count);
  }
  const maxTypeCount = Math.max(1, ...totalsByType.values());

  const byCompany = new Map<string, { companyName: string; count: number }>();
  for (const row of scopedAnalytics) {
    const existing = byCompany.get(row.companyId);
    byCompany.set(row.companyId, {
      companyName: row.companyName,
      count: (existing?.count ?? 0) + row.count,
    });
  }

  // Real PRD §2.3 effectiveness metrics, aggregated over `events` and
  // scoped to the same company + date filters as everything else on this
  // page (src/lib/admin/analytics.ts).
  const effectiveness = await platformEffectiveness(range, selectedCompany?.id);

  return (
    <div>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[var(--admin-ink)]">
        Platform analytics
      </h1>
      <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
        {totalEvents} event{totalEvents === 1 ? "" : "s"} recorded
        {selectedCompany ? ` for ${selectedCompany.name}` : " across every tenant"}
        {range ? " in the selected date range" : ""}.
      </p>

      <Panel className="mt-6 border-[var(--admin-nav-active-bg)] bg-[var(--admin-nav-active-bg)]/40">
        <Eyebrow className="text-[var(--admin-accent)]">Why this page matters</Eyebrow>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--admin-ink)]">
          This is where the founder judges whether the whole product is working — not any single
          company&apos;s dashboard. If bookings and reviews aren&apos;t moving here, the platform
          isn&apos;t working yet, no matter how good one tenant looks.
        </p>
      </Panel>

      <Panel className="mt-6">
        <AnalyticsFilterBar
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          currentCompanyId={companyId}
          currentFrom={fromStr}
          currentTo={toStr}
        />
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Companies"
          value={selectedCompany ? 1 : companies.length}
          hint={selectedCompany ? selectedCompany.name : `${companies.filter((c) => c.status === "active").length} active`}
        />
        <StatCard label="Guides" value={totalGuidesInScope} />
        <StatCard label="Boat tours" value={boatTours.count} hint={boatTours.hint} />
        <StatCard
          label="Tracked events"
          value={totalEvents}
          hint={range ? "in selected range" : "all time"}
        />
      </div>

      <Panel className="mt-6">
        <SectionHeading
          title="Effectiveness (PRD §2.3 supporting metrics)"
          description="Live counts aggregated from events, scoped to the filters above."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {effectiveness.map((metric) => (
            <div key={metric.key}>
              <Eyebrow>{metric.label}</Eyebrow>
              <p className="font-display mt-2 text-3xl leading-none font-semibold tracking-tight text-[var(--admin-ink)]">
                {metric.value}
                {metric.unit ?? ""}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionHeading title="By event type" />
          <div className="space-y-4">
            {[...totalsByType.entries()].map(([type, count]) => (
              <div key={type}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs text-[var(--admin-ink-soft)]">{type}</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--admin-ink)]">{count}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-accent)]"
                    style={{ width: `${Math.max(2, (count / maxTypeCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {totalsByType.size === 0 ? (
              <p className="text-sm text-[var(--admin-ink-soft)]">No events recorded yet.</p>
            ) : null}
          </div>
        </Panel>

        <Panel padded={false} className="overflow-hidden">
          <div className="p-5">
            <SectionHeading title="By company" />
          </div>
          <AdminTable
            className="rounded-none border-0 shadow-none"
            columns={["Company", "Events"]}
            columnWidths={[undefined, "text-right"]}
            rows={[...byCompany.values()].map((company) => [company.companyName, String(company.count)])}
            emptyMessage="No events recorded yet."
          />
        </Panel>
      </div>
    </div>
  );
}
