// Features BoatLocal cruises of selected operators on the 360 Amsterdam Tours map
// (company_boat_features rows — boat_tours itself is the global catalogue).
// Usage: node --env-file=.env.local scripts/feature-boats-360-amsterdam-tours.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const OPERATORS = ["offcourse", "amsterdamboatadventures", "lamardriboatcruises", "friendshipamsterdam", "pureboats", "sebiboattours", "starboardboats", "ecoboatsamsterdam"];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const feed = await (await fetch("https://boatlocal.nl/api/public/cruises")).json();
// Seasonal Light Festival cruises are left off for now; ecoboats only contributes its evening cruise.
const EXTRA_SLUGS = ["evening-boat-tour-amsterdam-central-station"];
// Ecoboats' "Private Boat - …" party-boat variants are also left off for now.
const isLightFestival = (name) => /light festival|^private boat - /i.test(name);
const slugs = feed.cruises
  .filter((c) => (OPERATORS.includes(c.company_shortname) || EXTRA_SLUGS.includes(c.slug)) && c.active !== false && !isLightFestival(c.name))
  .map((c) => c.slug);
const { data: tours } = await db.from("boat_tours").select("id,name,slug,status,active").in("slug", slugs);
const { data: company } = await db.from("companies").select("id").ilike("name", "360 Amsterdam Tours").single();
const { data: existing } = await db.from("company_boat_features").select("boat_tour_id,position").eq("company_id", company.id);

// Drop excluded (Light Festival / Private Boat) tours that were featured earlier.
const { data: featured } = await db.from("company_boat_features").select("boat_tour_id, boat_tours(name)").eq("company_id", company.id);
const lf = featured.filter((f) => isLightFestival(f.boat_tours?.name ?? "")).map((f) => f.boat_tour_id);
if (lf.length) {
  console.log(`Removing ${lf.length} excluded tours`);
  if (!dryRun) await db.from("company_boat_features").delete().eq("company_id", company.id).in("boat_tour_id", lf);
}
const have = new Set(existing.map((e) => e.boat_tour_id));
let position = Math.max(0, ...existing.map((e) => e.position ?? 0));

const missing = slugs.filter((s) => !tours.some((t) => t.slug === s));
if (missing.length) console.warn("Not in boat_tours yet:", missing);
const rows = tours
  .filter((t) => t.status === "active" && t.active !== false && !have.has(t.id))
  .map((t) => ({ company_id: company.id, boat_tour_id: t.id, is_featured: true, position: ++position }));
console.log(`${rows.length} to feature (${tours.length} found, ${have.size} already featured)`);
rows.forEach((r) => console.log(" +", tours.find((t) => t.id === r.boat_tour_id).name));
if (!dryRun && rows.length) {
  const { error } = await db.from("company_boat_features").insert(rows);
  if (error) { console.error(error.message); process.exit(1); }
}
