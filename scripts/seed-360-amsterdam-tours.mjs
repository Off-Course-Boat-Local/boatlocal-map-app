// Sets up 360 Amsterdam Tours as its own company (logo, orange branding) with
// guide Savannah, copies every FreeDam Tours recommendation into it and clones
// Sergio's Welcome Hub as Savannah's hub (her photo instead of Sergio's, names
// swapped, FreeDam-only links/discounts/review links dropped).
//
// Usage: node --env-file=.env.local scripts/seed-360-amsterdam-tours.mjs [--dry-run]
// Idempotent: finds the company by name; recommendations already copied
// (same name + address) are skipped; the hub's blocks are replaced.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env (run with --env-file=.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  process.exit(1);
};

const COMPANY_NAME = "360 Amsterdam Tours";
const SOURCE_NAME = "FreeDam Tours";
const OWNER_EMAIL = "info@360amsterdamtours.com";
const SITE = "https://360amsterdamtours.com";
const REVIEW_URLS = {
  tripadvisor:
    "https://www.tripadvisor.nl/Attraction_Review-g188590-d6454312-Reviews-360_Amsterdam_Tours-Amsterdam_North_Holland_Province.html",
  google:
    "https://www.google.com/maps/place/360+Amsterdam+Tours/@52.3698571,4.9009682,437m/data=!3m1!1e3!4m8!3m7!1s0x47c609c6e030e45d:0x2b30206173be5790!8m2!3d52.3701574!4d4.9028205!9m1!1b1!16s%2Fg%2F1q5bm82h9",
};
const GUIDE = { name: "Savannah", slug: "savannah", avatar_initial: "S" };
const dir = new URL("./data/360-amsterdam-tours/", import.meta.url);
const publicUrl = (bucket, path) => `${url}/storage/v1/object/public/${bucket}/${path}`;

async function upload(bucket, path, file, contentType) {
  const { error } = await db.storage.from(bucket).upload(path, fs.readFileSync(new URL(file, dir)), { contentType, upsert: true });
  if (error) fail(`upload ${path}: ${error.message}`);
  return publicUrl(bucket, path);
}

const { data: source } = await db.from("companies").select("*").ilike("name", SOURCE_NAME).single();
const { data: srcGuide } = await db.from("guides").select("*").eq("company_id", source.id).eq("slug", "sergio").single();

// ---- company ---------------------------------------------------------------
let { data: company } = await db.from("companies").select("*").ilike("name", COMPANY_NAME).maybeSingle();
if (!company) {
  console.log(`Creating ${COMPANY_NAME}`);
  if (dryRun) process.exit(0);
  const ins = await db
    .from("companies")
    .insert({
      name: COMPANY_NAME,
      company_type: "tour operator",
      app_name: `${COMPANY_NAME} Local Tips`,
      brand_primary: "#FF6600",
      brand_primary_dark: "#CC5200",
      brand_accent: "#FF6600",
      brand_surround: "#FFF4EC",
      status: "active",
      owner_email: OWNER_EMAIL,
      owner_status: "invited",
      owner_invite_token: `inv_${randomUUID().replace(/-/g, "")}`,
      modules: source.modules,
    })
    .select("*")
    .single();
  if (ins.error) fail(ins.error.message);
  company = ins.data;
}
const logoUrl = await upload("company-logos", `${company.id}.png`, "logo.png", "image/png");
await db
  .from("companies")
  .update({ logo_url: logoUrl, google_review_url: REVIEW_URLS.google, tripadvisor_review_url: REVIEW_URLS.tripadvisor }).eq("id", company.id);

// ---- guide -----------------------------------------------------------------
let { data: guide } = await db.from("guides").select("*").eq("company_id", company.id).eq("slug", GUIDE.slug).maybeSingle();
if (!guide) {
  const ins = await db
    .from("guides")
    .insert({
      company_id: company.id,
      email: OWNER_EMAIL,
      status: "active",
      welcome_message: srcGuide.welcome_message,
      ...GUIDE,
    })
    .select("*")
    .single();
  if (ins.error) fail(ins.error.message);
  guide = ins.data;
}
const photoUrl = await upload("recommendation-photos", `guides/${guide.id}/savannah.jpg`, "savannah.jpg", "image/jpeg");
await db.from("guides").update({ avatar_url: photoUrl }).eq("id", guide.id);

// ---- recommendations -------------------------------------------------------
const brandText = (s) =>
  typeof s === "string"
    ? s.replace(/Sergio/g, "Savannah").replace(/FreeDam Tours/g, COMPANY_NAME).replace(/FreeDam/g, "360 Amsterdam Tours")
    : s;
const { data: srcRecs } = await db.from("recommendations").select("*").eq("company_id", source.id);
const { data: existing } = await db.from("recommendations").select("id,name,address").eq("company_id", company.id);
const idMap = new Map();
const rows = [];
for (const r of srcRecs) {
  const dupe = existing.find((e) => e.name === r.name && e.address === r.address);
  if (dupe) {
    idMap.set(r.id, dupe.id);
    continue;
  }
  const id = randomUUID();
  idMap.set(r.id, id);
  const { id: _id, created_at, updated_at, ...rest } = r;
  rows.push({ ...rest, id, company_id: company.id, guide_id: null, created_by: null, note: /10% off|discount/i.test(r.note ?? "") ? "Elegant French brasserie in the former Berlage stock exchange building, right by Dam Square." : brandText(r.note) });
}
for (let i = 0; i < rows.length; i += 50) {
  const { error } = await db.from("recommendations").insert(rows.slice(i, i + 50));
  if (error) fail(`recommendations: ${error.message}`);
}
console.log(`Recommendations: ${rows.length} copied, ${srcRecs.length - rows.length} already there`);

// ---- hub -------------------------------------------------------------------
const { data: srcHub } = await db.from("welcome_hubs").select("id").eq("company_id", source.id).eq("guide_id", srcGuide.id).single();
const { data: srcBlocks } = await db.from("welcome_blocks").select("*").eq("hub_id", srcHub.id).order("display_order");

const FREEDAM_ONLY = /freedam|fareharbor|bistro berlage|maps\.app\.goo\.gl|maps-screenshot|Google Maps lists/i;
const dropHeadings = new Set(["Continue exploring with our tours", "Amsterdam maps"]);
let blocks = srcBlocks
  .filter((b) => b.block_type !== "review_card")
  .filter((b) => !FREEDAM_ONLY.test(JSON.stringify(b.content)) || b.block_type === "guide_hero")
  .filter((b) => !(b.block_type === "heading" && dropHeadings.has(b.content.text)))
  // FreeDam's own tours (their text never names FreeDam, so match them explicitly).
  .filter((b) => !(b.block_type === "paragraph" && /^(In the Footsteps of Anne Frank|Absolutely Amsterdam Tour)/.test(b.content.text)))
  .map((b) => {
    let content = JSON.parse(JSON.stringify(b.content), (_, v) => brandText(v));
    if (b.block_type === "guide_hero") content.photoUrl = photoUrl;
    if (b.block_type === "cta_banner") content.href = content.href.replace(/\?partner=.*/, "");
    if (b.block_type === "cta_banner" && /boatlocal/i.test(content.label)) content.label = "See all boats on BoatLocal";
    if (b.block_type === "boat_tour_card") content.headline = "Tonight's pick";
    if (b.block_type === "featured_places") {
      content.showDiscountBadge = false; // the discounts are FreeDam Tours' deals
      content.placeIds = content.placeIds.map((id) => idMap.get(id)).filter(Boolean);
    }
    return { block_type: b.block_type, content };
  });
// Off Course Amsterdam photo under the BoatLocal heading.
const boatPhoto = await upload("recommendation-photos", "360-amsterdam-tours/boatlocal-offcourse.webp", "boatlocal-offcourse.webp", "image/webp");
const bh = blocks.findIndex((b) => b.block_type === "heading" && b.content.text === "Explore Amsterdam by water");
if (bh >= 0)
  blocks.splice(bh + 1, 0, {
    block_type: "image",
    content: { url: boatPhoto, alt: "Guests on an Off Course Amsterdam boat" },
  });
// Make the whole BoatLocal section one dark-navy panel so it stands out.
if (bh >= 0) {
  let i = bh;
  do {
    blocks[i].content = { ...blocks[i].content, panel: "dark" };
    i++;
  } while (i < blocks.length && blocks[i - 1].block_type !== "cta_banner");
}
// Review prompt at the very top (FreeDam's own review card was dropped above).
blocks.splice(0, 0, {
  block_type: "review_card",
  content: {
    promptText: "If you enjoyed the tour, please leave a review",
    platforms: ["tripadvisor", "google"],
    urls: REVIEW_URLS,
  },
});
// The "Amsterdam maps" heading was dropped, so the category shortcuts need their own.
const sc = blocks.findIndex((b) => b.block_type === "category_shortcuts");
if (sc >= 0) blocks.splice(sc, 0, { block_type: "heading", content: { text: "Find places by category", level: 2 } });
blocks.push({
  block_type: "cta_banner",
  content: { label: "Book a tour with 360 Amsterdam Tours", href: SITE },
});
blocks = blocks.map((b, display_order) => ({ id: randomUUID(), display_order, ...b }));

let { data: hub } = await db.from("welcome_hubs").select("id").eq("company_id", company.id).eq("guide_id", guide.id).maybeSingle();
if (!hub) {
  const ins = await db
    .from("welcome_hubs")
    .insert({ company_id: company.id, guide_id: guide.id, title: "Savannah's Amsterdam", intro: "", is_active: true })
    .select("id")
    .single();
  if (ins.error) fail(ins.error.message);
  hub = ins.data;
}
await db.from("welcome_blocks").delete().eq("hub_id", hub.id);
const add = await db.from("welcome_blocks").insert(blocks.map((b) => ({ ...b, hub_id: hub.id })));
if (add.error) fail(add.error.message);
console.log(`Hub ${hub.id}: ${blocks.length} blocks`);
console.log(`Company ${company.id}  Guide ${guide.id}  logo ${logoUrl}`);
