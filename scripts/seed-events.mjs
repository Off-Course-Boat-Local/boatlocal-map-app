// Seeds realistic analytics events so Admin's dashboards have something to
// aggregate. Run with:
//
//   node --env-file=.env.local scripts/seed-events.mjs
//   node --env-file=.env.local scripts/seed-events.mjs --clear
//
// WHY THIS EXISTS: `events` is written only by the guest app
// (recordGuestEvent -> recordEvent), so until real guests use real tenant
// links the table stays empty and every Admin metric reads 0. That was the
// original justification for src/lib/admin/mockAnalytics.ts; this script
// replaces that mock with real rows, so the pages can run real aggregations
// against the real RPCs.
//
// EVERY row it writes carries metadata.seed = true. That is the entire
// cleanup story — `--clear` deletes exactly those rows and nothing else, so
// seeded data can never be confused with genuine traffic, and genuine
// traffic can never be deleted by this script.
//
// Uses the service-role key: `events` has an anon INSERT policy but no
// DELETE policy for any client role, so --clear specifically needs to
// bypass RLS.

import { createClient } from "@supabase/supabase-js";

const SEED_MARKER = { seed: true };
const DAYS = 60;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with: node --env-file=.env.local scripts/seed-events.mjs");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function clearSeeded() {
  const { error, count } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .contains("metadata", SEED_MARKER);
  if (error) throw error;
  console.log(`Removed ${count ?? 0} seeded event(s).`);
}

if (process.argv.includes("--clear")) {
  await clearSeeded();
  process.exit(0);
}

// Deterministic PRNG so re-running produces the same distribution — the
// numbers on the dashboard shouldn't move just because the script ran twice.
let state = 1337;
function rand() {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x7fffffff;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

// Relative weights, roughly shaped like a real funnel: many opens, fewer
// saves, fewer clicks still, and bookings a small fraction of clicks.
// booking_outcome is included so the conversion metric has a numerator —
// nothing writes it in the app yet (the attribution webhook stores outcomes
// separately), but the enum value exists for exactly this.
const FUNNEL = [
  ["app_open", 100],
  ["tip_viewed", 70],
  ["tip_saved", 28],
  ["tip_unsaved", 5],
  ["directions_requested", 22],
  ["boat_book_click", 14],
  ["booking_outcome", 2],
  ["review_click_google", 6],
  ["review_click_tripadvisor", 3],
  ["review_private_feedback", 2],
  ["app_install", 8],
];
const PLATFORMS = ["ios", "android", "desktop", "unknown"];

const { data: companies, error: cErr } = await supabase.from("companies").select("id, name");
if (cErr) throw cErr;
if (!companies?.length) {
  console.error("No companies found — create one in Admin first.");
  process.exit(1);
}

const { data: guides, error: gErr } = await supabase.from("guides").select("id, company_id");
if (gErr) throw gErr;

// Re-seeding replaces rather than accumulates, so running twice doesn't
// silently double every number.
await clearSeeded();

const rows = [];
const now = Date.now();

for (const company of companies) {
  const companyGuides = (guides ?? []).filter((g) => g.company_id === company.id);

  for (const [eventType, weight] of FUNNEL) {
    // Scale by weight, with a per-company multiplier so tenants don't all
    // look identical on the platform table.
    const companyScale = 0.6 + rand() * 1.2;
    const total = Math.round(weight * companyScale);

    for (let i = 0; i < total; i++) {
      // Bias toward recent days so a 7-day filter isn't empty while a
      // 60-day one is full.
      const daysAgo = Math.floor(Math.pow(rand(), 1.7) * DAYS);
      const occurredAt = new Date(now - daysAgo * 86400000 - Math.floor(rand() * 86400000));

      rows.push({
        event_type: eventType,
        company_id: company.id,
        // Not every event belongs to a guide — app_install and some opens
        // happen before a guide link is involved.
        guide_id: companyGuides.length && rand() > 0.25 ? pick(companyGuides).id : null,
        platform: pick(PLATFORMS),
        metadata: SEED_MARKER,
        occurred_at: occurredAt.toISOString(),
      });
    }
  }
}

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const { error } = await supabase.from("events").insert(chunk);
  if (error) throw error;
}

console.log(`Seeded ${rows.length} events across ${companies.length} company(ies).`);
console.log("Remove them any time with: node --env-file=.env.local scripts/seed-events.mjs --clear");
