// Sets up FreeDam Tours + guide Sergio and seeds Sergio's own Welcome Hub with
// the content of https://www.freedamtours.com/sergio (every guide has their own
// environment: this is a guide-level hub, not the company default).
//
// Usage: node --env-file=.env.local scripts/seed-freedam-sergio-hub.mjs [--setup-only] [--dry-run]
//
//   --setup-only  create/find the company and guide, then stop (do this before
//                 adding places, so the places have a company to belong to)
//   --dry-run     report what would happen, write nothing
//
// Idempotent: finds the company ("FreeDam Tours") and guide (slug "sergio")
// before creating them, and replaces the blocks of an existing hub. Places are
// matched by name inside the company's recommendations; a missing place is
// skipped with a warning (add it in Studio, then re-run).

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const dryRun = process.argv.includes("--dry-run");
const setupOnly = process.argv.includes("--setup-only");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const COMPANY_NAME = "FreeDam Tours";
const OWNER_EMAIL = "info@freedamtours.com";
const GUIDE = {
  name: "Sergio",
  slug: "sergio",
  avatar_initial: "S",
  welcome_message:
    "I hope you enjoyed discovering Amsterdam with me today. This page keeps all my favourite recommendations, links and discounts in one place.",
};
const REVIEW_URLS = {
  tripadvisor: "https://tinyurl.com/yx9e7zhm",
  guruwalk: "https://tinyurl.com/jz3bax3n",
  google:
    "https://www.google.com/maps/place/Freedam+Tours/@52.3742957,4.8904794,17z/data=!4m8!3m7!1s0x47c6095029a5d443:0xb32f4b002007527e!8m2!3d52.374255!4d4.8954052!9m1!1b1!16s%2Fg%2F11g0ht_84d",
};

// ---- company + guide ------------------------------------------------------
let { data: company, error: coErr } = await db.from("companies").select("id,name").ilike("name", COMPANY_NAME).maybeSingle();
if (coErr) fail(coErr.message);
if (!company) {
  console.log(`Creating company ${COMPANY_NAME}`);
  if (!dryRun) {
    const ins = await db
      .from("companies")
      .insert({
        name: COMPANY_NAME,
        company_type: "tour operator",
        app_name: `${COMPANY_NAME} Local Tips`,
        // Onboarding defaults (src/lib/data/source.ts ONBOARDING_DEFAULT_BRAND) — set real colours in Studio > Branding.
        brand_primary: "#52525B",
        brand_primary_dark: "#3F3F46",
        brand_accent: "#A1A1AA",
        brand_surround: "#F4F4F5",
        google_review_url: REVIEW_URLS.google,
        tripadvisor_review_url: REVIEW_URLS.tripadvisor,
        status: "active",
        owner_email: OWNER_EMAIL,
        owner_status: "invited",
        owner_invite_token: `inv_${randomUUID().replace(/-/g, "")}`,
      })
      .select("id,name")
      .single();
    if (ins.error) fail(ins.error.message);
    company = ins.data;
  } else company = { id: "(dry-run)", name: COMPANY_NAME };
}

let { data: guide, error: gErr } = await db.from("guides").select("id,name,avatar_url").eq("company_id", company.id).eq("slug", GUIDE.slug).maybeSingle();
if (gErr && company.id !== "(dry-run)") fail(gErr.message);
if (!guide) {
  console.log(`Creating guide ${GUIDE.name}`);
  if (!dryRun) {
    const ins = await db
      .from("guides")
      .insert({ company_id: company.id, email: OWNER_EMAIL, status: "active", ...GUIDE })
      .select("id,name")
      .single();
    if (ins.error) fail(ins.error.message);
    guide = ins.data;
  } else guide = { id: "(dry-run)", name: GUIDE.name };
}
console.log(`Company ${company.name} (${company.id})  Guide ${guide.name} (${guide.id})`);
if (setupOnly) process.exit(0);

// ---- places ---------------------------------------------------------------
const { data: recs, error: rErr } = await db.from("recommendations").select("id,name").eq("company_id", company.id);
if (rErr) fail(rErr.message);
const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
function ids(...names) {
  const out = [];
  for (const n of names) {
    const hit = (recs ?? []).find((r) => norm(r.name).includes(norm(n)));
    if (hit) out.push(hit.id);
    else console.warn(`WARN: no place matching "${n}" — skipped.`);
  }
  return out;
}

const cta = (label, href) => ["cta_banner", { label, href }];
const h = (text, level = 2) => ["heading", { text, level }];
const p = (text) => ["paragraph", { text }];
const img = (url, alt, caption) => ["image", { url, alt, caption }];

const blocks = [
  ["guide_hero", { title: "Thank you for joining the tour!", greeting: "I hope you enjoyed discovering Amsterdam with me today. A tour can only scratch the surface, so this page is here to help you keep exploring with confidence. Bookmark it and use it throughout your stay.", showAvatar: true, photoUrl: guide.avatar_url }],
  img("https://hacjzxdyxudcldzwzhbr.supabase.co/storage/v1/object/public/recommendation-photos/freedam/bloemenvelden.jpg", "Amsterdam flower fields", "Tulips in the Dutch countryside"),
  ["review_card", { promptText: "Recommend us! A review keeps me motivated as a guide — and I get a small bonus for every 5-star review, so mention my name 😉", platforms: ["tripadvisor", "guruwalk", "google"], urls: REVIEW_URLS }],
  h("Explore Amsterdam by water"),
  p("BoatLocal.nl: independent skippers open their boats (and their stories) to small groups. Boats that feel like floating living rooms, skippers who know the city like an old friend, and a slow, intimate pace — the opposite of the big tourist boats."),
  ["boat_tour_card", { headline: "Explore Amsterdam by water" }],
  cta("Book a boat on BoatLocal", "https://boatlocal.nl?partner=14&bl-campaign=1749633008552x348873959505395700"),
  h("Continue exploring with our tours"),
  p("In the Footsteps of Anne Frank: Amsterdam During WWII — a moving walk through the city's wartime past, from Anne Frank's early years in Amsterdam to how the occupation changed everyday life."),
  cta("Book: Anne Frank tour", "https://fareharbor.com/embeds/book/freedamtours/items/200460/?ref=Sergio&flow=317720&full-items=yes"),
  p("Absolutely Amsterdam Tour — a broad, engaging journey through the city's history, architecture, culture and hidden corners."),
  cta("Book: Absolutely Amsterdam", "https://fareharbor.com/embeds/book/freedamtours/items/200463/?ref=guide-sergio&flow=317720&full-items=yes"),
  h("Lunch near Dam Square"),
  ["featured_places", { placeIds: ids("Bistro Berlage", "Cut Throat", "Bakkerswinkel"), showDiscountBadge: true }],
  ["tip_box", { title: "10% off at Bistro Berlage", body: "Show your tour confirmation (email or booking confirmation) and tell them you did the tour with Sergio to get 10% off all food.", style: "tip" }],
  cta("Reserve a table at Bistro Berlage", "https://bistroberlage.com/en/book-a-table/"),
  h("Amsterdam maps"),
  p("Together with the other FreeDam guides we made Google Maps lists of our favourite restaurants, bars, cafés, bakeries, nightlife spots and hidden gems."),
  img("https://hacjzxdyxudcldzwzhbr.supabase.co/storage/v1/object/public/recommendation-photos/freedam/maps-screenshot.png", "FreeDam Tours Google Maps lists", "Our curated Google Maps lists"),
  ["category_shortcuts", { categoryKeys: ["breakfast", "lunch", "dinner", "drinks", "dancing"] }],
  cta("Lunch map", "https://maps.app.goo.gl/Dwn7mtC9to5aAHc26"),
  cta("Dinner map", "https://maps.app.goo.gl/FZeVuPQi8MdWC95H9"),
  cta("Vegan restaurants & bakeries map", "https://maps.app.goo.gl/W6xVNPChP7ijwcWu6"),
  cta("Bars & coffeeshops map", "https://maps.app.goo.gl/rCCJETfPsEzzjLoa8"),
  h("Some of my favourite places"),
  p("1. The Begijnhof — a hidden courtyard that feels like another century, with a 'hidden Catholic church' you can visit for free (it's opposite the actual church)."),
  p("2. De Pijp — multicultural, creative and full of energy. Don't miss Albert Cuyp Market (stroopwafels, Surinamese snacks, Turkish sweets) and the quiet Sarphatipark."),
  p("3. Vondelpark — Amsterdam's green living room: picnic, cycle, nap in the grass or watch the world go by."),
  p("4. NDSM Wharf — a former shipyard in Amsterdam-Noord, now home to the STRAAT street-art museum, the monthly IJ-hallen flea market, festivals and sweeping views over the IJ."),
  ["tip_box", { title: "Getting to NDSM", body: "Take the free F4 ferry from the waterfront side of Amsterdam Central Station. Every 10–15 minutes, about 14 minutes. Stand on the right side for the best skyline views.", style: "tip" }],
  h("My favourite (typically Dutch) bars"),
  ["featured_places", { placeIds: ids("'t Smalle", "de Dokter", "Waterkant", "Brandon", "Papeneiland", "Hannekes Boom", "van Wees"), showDiscountBadge: false }],
  h("My favourite restaurants"),
  ["featured_places", { placeIds: ids("Moeders", "The Pantry", "Kartika", "Toko Bersama", "Mata Hari", "Secret Garden", "Van Dobben"), showDiscountBadge: false }],
  h("Rainy day & hidden gems"),
  ["featured_places", { placeIds: ids("Rijksmuseum", "STRAAT", "NEMO", "Madam"), showDiscountBadge: false }],
  ["tip_box", { title: "Hidden gem: NEMO roof", body: "The huge rooftop terrace of the NEMO Science Museum is free — you don't need a museum ticket, just walk up the steps (open till 5:30pm). Also: have a drink or a bite at Madam restaurant and get free access to the A'DAM roof instead of buying a Lookout ticket.", style: "tip" }],
  p("My favourite Dutch snack: bitterballen — best enjoyed during borreltijd (Dutch happy hour) with a cold blonde beer. Try Proeflokaal A. van Wees or Eetsalon Van Dobben."),
  ["tip_box", { title: "What I'd avoid", body: "Stroopwafels at €8–10 in tourist shops (get them fresh and cheap at bakeries or markets). Tourist-trap restaurants around Dam Square, Leidseplein and the Red Light District. Renting a bike if you're not confident in dense city traffic. Madame Tussauds — Amsterdam has world-class museums with real art instead.", style: "warning" }],
  p("Tot ziens! 🇳🇱 Thanks again for joining me today — I hope to see you again on another FreeDam Tours experience. – Sergio"),
  p("FreeDam Tours · Meeting point: Beursplein 5, 1012 JW Amsterdam · info@freedamtours.com · +31 (0)6 40 79 02 79"),
].filter(([type, content], i, all) => {
  // A featured_places block with no resolved places is dropped together with the heading introducing it.
  if (type === "featured_places" && content.placeIds.length === 0) return false;
  if (type === "heading" && all[i + 1]?.[0] === "featured_places" && all[i + 1][1].placeIds.length === 0) return false;
  return true;
}).map(([block_type, content], display_order) => ({ id: randomUUID(), block_type, display_order, content }));

console.log(`Blocks: ${blocks.length}`);
if (dryRun) {
  console.log("Dry run — nothing written.");
  process.exit(0);
}

let { data: hub, error: hubErr } = await db.from("welcome_hubs").select("id").eq("company_id", company.id).eq("guide_id", guide.id).maybeSingle();
if (hubErr) fail(hubErr.message);
if (!hub) {
  const ins = await db
    .from("welcome_hubs")
    .insert({ company_id: company.id, guide_id: guide.id, title: "Sergio's Amsterdam", intro: "", is_active: true })
    .select("id")
    .single();
  if (ins.error) fail(ins.error.message);
  hub = ins.data;
}
const del = await db.from("welcome_blocks").delete().eq("hub_id", hub.id);
if (del.error) fail(del.error.message);
const add = await db.from("welcome_blocks").insert(blocks.map((b) => ({ ...b, hub_id: hub.id })));
if (add.error) fail(add.error.message);
console.log(`Seeded Sergio's hub ${hub.id}.`);
