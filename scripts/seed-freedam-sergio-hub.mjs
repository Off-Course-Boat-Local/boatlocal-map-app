// Seeds Sergio's Welcome Hub for FreeDam Tours (the demo from the welcome-hub
// plan, Task 7): thank-you hero, review links, category shortcuts, two featured
// places, the BoatLocal tour card and two tip boxes.
//
// Usage: node --env-file=.env.local scripts/seed-freedam-sergio-hub.mjs [--dry-run]
//
// Looks the company ("FreeDam Tours"), guide ("Sergio") and places by name and
// stops with a clear message if any is missing — it never creates a company or
// guide. Idempotent: an existing hub for (company, guide) has its blocks
// replaced. Review-platform URLs come from env (TRIPADVISOR_REVIEW_URL,
// GOOGLE_REVIEW_URL, GURUWALK_REVIEW_URL); platforms without a URL are left out
// of the card rather than linking somewhere made up.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const { data: companies, error: coErr } = await db.from("companies").select("id,name").ilike("name", "FreeDam Tours");
if (coErr) fail(coErr.message);
if (companies.length !== 1) fail(`expected exactly one company named "FreeDam Tours", found ${companies.length}.`);
const company = companies[0];

const { data: guides, error: gErr } = await db
  .from("guides")
  .select("id,name")
  .eq("company_id", company.id)
  .ilike("name", "Sergio%");
if (gErr) fail(gErr.message);
if (guides.length !== 1) fail(`expected exactly one guide named Sergio at ${company.name}, found ${guides.length}.`);
const guide = guides[0];

async function placeId(fragment) {
  const { data, error } = await db
    .from("recommendations")
    .select("id,name")
    .eq("company_id", company.id)
    .ilike("name", `%${fragment}%`);
  if (error) fail(error.message);
  if (data.length !== 1) fail(`expected one place matching "${fragment}", found ${data.length}. Add it in Studio first.`);
  return data[0].id;
}
const placeIds = [await placeId("Berlage"), await placeId("smalle")];

const urls = Object.fromEntries(
  [
    ["tripadvisor", process.env.TRIPADVISOR_REVIEW_URL],
    ["google", process.env.GOOGLE_REVIEW_URL],
    ["guruwalk", process.env.GURUWALK_REVIEW_URL],
  ].filter(([, v]) => /^https?:\/\//i.test(v ?? "")),
);

const blocks = [
  ["guide_hero", { title: "Bedankt voor de tour!", greeting: "Het was een genot om Amsterdam met jullie te delen. Hieronder mijn favoriete plekken.", showAvatar: true }],
  ["review_card", { promptText: "Vond je de tour leuk? Een review helpt ons enorm!", platforms: ["tripadvisor", "google", "guruwalk"].filter((p) => urls[p]), urls }],
  // Only keys that exist as app categories filter the map/list.
  ["category_shortcuts", { categoryKeys: ["lunch", "dinner", "drinks", "dancing"] }],
  ["featured_places", { placeIds, showDiscountBadge: true }],
  ["boat_tour_card", { headline: "Amsterdam vanaf het water" }],
  ["tip_box", { title: "Gratis NDSM-veer", body: "Neem het gratis veer achter Centraal Station naar NDSM — elke paar minuten, 24/7.", style: "tip" }],
  ["tip_box", { title: "Wat te vermijden", body: "Overpriced stroopwafels bij de toeristische kraampjes. Koop ze vers op de markt.", style: "warning" }],
].map(([block_type, content], display_order) => ({ id: randomUUID(), block_type, display_order, content }));

console.log(`Company: ${company.name}  Guide: ${guide.name}  Blocks: ${blocks.length}  Review links: ${Object.keys(urls).join(", ") || "none"}`);
if (dryRun) {
  console.log("Dry run — nothing written.");
  process.exit(0);
}

let { data: hub, error: hubErr } = await db
  .from("welcome_hubs")
  .select("id")
  .eq("company_id", company.id)
  .eq("guide_id", guide.id)
  .maybeSingle();
if (hubErr) fail(hubErr.message);
if (!hub) {
  const ins = await db
    .from("welcome_hubs")
    .insert({ company_id: company.id, guide_id: guide.id, title: "Welkom bij FreeDam Tours", intro: "", is_active: true })
    .select("id")
    .single();
  if (ins.error) fail(ins.error.message);
  hub = ins.data;
}
const del = await db.from("welcome_blocks").delete().eq("hub_id", hub.id);
if (del.error) fail(del.error.message);
const add = await db.from("welcome_blocks").insert(blocks.map((b) => ({ ...b, hub_id: hub.id })));
if (add.error) fail(add.error.message);
console.log(`Seeded hub ${hub.id}.`);
