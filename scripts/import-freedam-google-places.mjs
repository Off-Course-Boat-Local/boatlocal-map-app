// Imports and enriches FreeDam Tours Google Maps recommendations into Supabase
//
// Usage: node --env-file=.env.local scripts/import-freedam-google-places.mjs [--dry-run] [--limit=10] [--no-photos]

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const skipPhotos = process.argv.includes("--no-photos");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleKey = process.env.GOOGLE_PLACES_API_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  process.exit(1);
}
if (!googleKey) {
  console.error("Missing GOOGLE_PLACES_API_KEY in .env.local.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const PLACES_BASE = "https://places.googleapis.com/v1";
const PHOTO_BUCKET = "recommendation-photos";
const AMSTERDAM_CENTER = { lat: 52.3702, lng: 4.8952 };

// Custom notes for Sergio's top picks mentioned on freedamtours.com/sergio
const SERGIO_NOTES = {
  "bistro berlage":
    "Show your tour confirmation (email or booking confirmation) and tell them you did the tour with Sergio to get 10% off all food.",
  "cut throat":
    "A cool hybrid barbershop, cafe and cocktail bar serving delicious brunch and street food.",
  "de bakkerswinkel":
    "Homely bakery and tearoom famous for fresh scones, homemade jams and hearty sandwiches.",
  "bakkerswinkel":
    "Homely bakery and tearoom famous for fresh scones, homemade jams and hearty sandwiches.",
  "t smalle":
    "Historic 18th-century jenever distillery turned brown cafe with one of the prettiest waterside terraces on the Egelantiersgracht.",
  "cafe de dokter":
    "The smallest bar in Amsterdam, founded in 1798. Candlelit, dusty and full of character — a true brown-café gem.",
  "waterkant":
    "Vibrant Surinamese-inspired waterfront bar with massive sun-drenched outdoor terrace along the canal.",
  "cafe brandon":
    "Classic, atmospheric brown café on the Keizersgracht that has changed little since the 17th century.",
  "brandon":
    "Classic, atmospheric brown café on the Keizersgracht that has changed little since the 17th century.",
  "cafe papeneiland":
    "A tiny, historic brown café on one of the most beautiful corners of Amsterdam. Cosy and candlelit — famous for apple pie.",
  "papeneiland":
    "A tiny, historic brown café on one of the most beautiful corners of Amsterdam. Cosy and candlelit — famous for apple pie.",
  "hannekes boom":
    "Colourful, laid-back waterfront bar built from reclaimed wood, with great sunset views over the water.",
  "proeflokaal a van wees":
    "Authentic Amsterdam tasting room on Herengracht with over 150 Dutch jenevers, craft beers and crispy bitterballen.",
  "proeflokaal t blauwe theehuis":
    "Iconic 1930s modernist pavilion in the middle of Vondelpark, run by Brouwerij 't IJ with great craft beers on tap.",
  "moeders":
    "Quirky Dutch restaurant where framed photos of mothers cover every wall — serving comforting stamppot and Dutch classics.",
  "the pantry":
    "Intimate Dutch eatery off Leidseplein serving hearty traditional dishes like hutspot, hachee and poffertjes.",
  "kartika":
    "One of Amsterdam's most authentic Indonesian restaurants, known for generous, fragrant rijsttafels on Overtoom.",
  "toko bersama":
    "Beloved Indonesian deli counter serving richly spiced rendang, gado-gado and authentic takeaway boxes.",
  "mata hari":
    "The only nice bar and restaurant in the Red Light District: soft lighting, vintage décor and big canal windows.",
  "secret garden":
    "Stunning garden-inspired restaurant blending Nikkei flavors with lavish greenery and cocktails.",
  "eetsalon van dobben":
    "A legendary fast-food institution since 1945, famous for its crunchy bitterballen and croquettes.",
  "van dobben":
    "A legendary fast-food institution since 1945, famous for its crunchy bitterballen and croquettes.",
  "rijksmuseum":
    "My best rainy-day activity: Rembrandt, Vermeer, ship models and dollhouses — easily 2–3 hours.",
  "straat museum":
    "World-class street art museum in a massive former shipyard warehouse at NDSM Wharf.",
  "straat":
    "World-class street art museum in a massive former shipyard warehouse at NDSM Wharf.",
  "nemo science museum":
    "The huge rooftop terrace of NEMO is free — you don't need a museum ticket, just walk up the steps for panoramic views.",
  "nemo":
    "The huge rooftop terrace of NEMO is free — you don't need a museum ticket, just walk up the steps for panoramic views.",
  "madam amsterdam":
    "Panoramic bar and restaurant at the top of A'DAM Tower — have a drink or bite here for free access to the rooftop.",
  "madam":
    "Panoramic bar and restaurant at the top of A'DAM Tower — have a drink or bite here for free access to the rooftop.",
  "begijnhof":
    "A hidden courtyard that feels like another century, with a 'hidden Catholic church' you can visit for free.",
  "vondelpark":
    "Amsterdam's green living room: picnic, cycle, nap in the grass or watch the world go by.",
};

// Places mentioned on Sergio's hub that might not be in the 4 maps
const EXTRA_SERGIO_PLACES = [
  { title: "Café 't Smalle", lists: ["nightlife"], body: "Café 't Smalle · Bruin café" },
  { title: "Café Brandon", lists: ["nightlife"], body: "Café Brandon · Bruin café" },
  { title: "The Pantry Amsterdam", lists: ["dinner"], body: "The Pantry · Nederlands restaurant" },
  { title: "Restaurant Kartika", lists: ["dinner"], body: "Restaurant Kartika · Indonesisch restaurant" },
  { title: "Proeflokaal A. van Wees", lists: ["nightlife"], body: "Proeflokaal A. van Wees · Proeflokaal" },
  { title: "STRAAT Museum", lists: ["lunch"], body: "STRAAT Museum · Museum" },
  { title: "NEMO Science Museum", lists: ["lunch"], body: "NEMO Science Museum · Museum" },
];

const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

function getSergioNote(name, area, categories, cuisineTypes) {
  const nName = norm(name);
  for (const [key, note] of Object.entries(SERGIO_NOTES)) {
    if (nName.includes(norm(key)) || norm(key).includes(nName)) {
      return note;
    }
  }

  // Sensible, warm default
  const areaPart = area ? `in ${area}` : "in Amsterdam";
  const tagsPart = cuisineTypes.length ? cuisineTypes.join(", ") : categories[0] || "great food";
  return `Recommended by Sergio & FreeDam Tours — a favourite spot ${areaPart} for ${tagsPart.toLowerCase()}.`;
}

function cleanOpeningHours(weekdayDescriptions) {
  if (!weekdayDescriptions || !weekdayDescriptions.length) return "";
  return weekdayDescriptions.join("; ");
}

function guessArea(components) {
  const priority = ["sublocality_level_1", "sublocality", "neighborhood", "locality"];
  for (const type of priority) {
    const match = components?.find((c) => c.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return "Amsterdam";
}

const CUISINE_RULES = [
  { match: (t, n) => t.includes("vegan_restaurant") || n.includes("vegan"), cuisine: "Vegan" },
  { match: (t, n) => t.includes("vegetarian_restaurant") || n.includes("vegetarisch"), cuisine: "Vegetarian" },
  { match: (t, n) => t.includes("bakery") || t.includes("pastry_shop") || n.includes("bakker") || n.includes("bagel"), cuisine: "Bakery" },
  { match: (t, n) => t.includes("breakfast_restaurant") || t.includes("brunch_restaurant") || n.includes("ontbijt") || n.includes("brunch") || n.includes("omelegg"), cuisine: "Breakfast & Brunch" },
  { match: (t, n) => n.includes("pancake") || n.includes("pannenkoek"), cuisine: "Pancakes" },
  { match: (t, n) => t.includes("dutch_restaurant") || n.includes("nederlands") || n.includes("hollands") || n.includes("bruin café") || n.includes("stamppot"), cuisine: "Dutch" },
  { match: (t, n) => t.includes("indonesian_restaurant") || n.includes("indonesisch") || n.includes("toko") || n.includes("rijsttafel"), cuisine: "Indonesian" },
  { match: (t, n) => n.includes("surinaams") || n.includes("roti") || n.includes("tokoman"), cuisine: "Surinamese" },
  { match: (t, n) => t.includes("italian_restaurant") || t.includes("pizza_restaurant") || n.includes("pizza") || n.includes("italiaans"), cuisine: "Italian" },
  { match: (t, n) => t.includes("french_restaurant") || n.includes("bistro") || n.includes("brasserie"), cuisine: "French" },
  { match: (t, n) => t.includes("japanese_restaurant") || t.includes("sushi_restaurant") || n.includes("sushi") || n.includes("japans"), cuisine: "Japanese" },
  { match: (t, n) => t.includes("ramen_restaurant") || n.includes("ramen"), cuisine: "Ramen" },
  { match: (t, n) => t.includes("mexican_restaurant") || n.includes("mexicaans"), cuisine: "Mexican" },
  { match: (t, n) => t.includes("thai_restaurant") || n.includes("thais"), cuisine: "Thai" },
  { match: (t, n) => t.includes("vietnamese_restaurant") || n.includes("vietnamees"), cuisine: "Vietnamese" },
  { match: (t, n) => t.includes("chinese_restaurant") || n.includes("chinees"), cuisine: "Chinese" },
  { match: (t, n) => t.includes("indian_restaurant") || n.includes("indiaas"), cuisine: "Indian" },
  { match: (t, n) => t.includes("mediterranean_restaurant") || n.includes("mediterraan"), cuisine: "Mediterranean" },
  { match: (t, n) => t.includes("middle_eastern_restaurant") || n.includes("turks") || n.includes("midden-oosters") || n.includes("kebab"), cuisine: "Middle Eastern" },
  { match: (t, n) => n.includes("tapas") || n.includes("spaans"), cuisine: "Spanish / Tapas" },
  { match: (t, n) => t.includes("seafood_restaurant") || n.includes("vis") || n.includes("seafood"), cuisine: "Seafood" },
  { match: (t, n) => t.includes("steak_house") || n.includes("steak"), cuisine: "Steakhouse" },
  { match: (t, n) => t.includes("sandwich_shop") || n.includes("sando") || n.includes("broodjes") || n.includes("deli"), cuisine: "Sandwiches" },
  { match: (t, n) => t.includes("coffee_shop") || (t.includes("cafe") && !t.includes("bar")), cuisine: "Coffee & Bakery" },
  { match: (t, n) => t.includes("night_club") || t.includes("bar") || t.includes("pub"), cuisine: "Drinks & Cocktails" },
];

function determineCuisines(types, name, lists, rawText) {
  const n = (name + " " + rawText).toLowerCase();
  const t = types.map((s) => s.toLowerCase());
  const out = new Set();

  if (lists.includes("vegan")) {
    out.add("Vegan");
  }

  for (const rule of CUISINE_RULES) {
    if (rule.match(t, n)) {
      out.add(rule.cuisine);
    }
  }

  return Array.from(out);
}

function determineCategories(lists, types, name, rawText) {
  const n = (name + " " + rawText).toLowerCase();
  const t = types.map((s) => s.toLowerCase());
  const cats = [];

  const isBakery = t.includes("bakery") || t.includes("pastry_shop") || n.includes("bakker") || n.includes("bagel") || n.includes("scones");
  const isBreakfast =
    t.includes("breakfast_restaurant") ||
    t.includes("brunch_restaurant") ||
    n.includes("ontbijt") ||
    n.includes("brunch") ||
    n.includes("omelegg") ||
    n.includes("pannenkoek") ||
    n.includes("pancake") ||
    n.includes("graefjes");
  const isClub = t.includes("night_club") || n.includes("club") || n.includes("dans") || n.includes("live muziek");
  const isDrinks = t.includes("bar") || t.includes("pub") || t.includes("wine_bar") || n.includes("bar") || n.includes("café") || n.includes("cafe") || n.includes("kroeg");
  const isCoffee = t.includes("coffee_shop") || (t.includes("cafe") && !isDrinks) || n.includes("koffie");
  const isMuseum = t.includes("museum") || t.includes("art_gallery") || t.includes("tourist_attraction") || n.includes("museum");

  if (isMuseum) {
    cats.push("see");
  }

  if (isBreakfast) {
    cats.push("breakfast");
    if (lists.includes("lunch")) cats.push("lunch");
  } else if (isBakery) {
    cats.push("breakfast");
    cats.push("coffee");
  }

  if (lists.includes("dinner")) {
    if (!cats.includes("dinner")) cats.push("dinner");
    if (lists.includes("lunch") && !cats.includes("lunch")) cats.push("lunch");
  } else if (lists.includes("lunch")) {
    if (!cats.includes("lunch")) cats.push("lunch");
  }

  if (lists.includes("nightlife")) {
    if (isClub) {
      if (!cats.includes("dancing")) cats.push("dancing");
      if (!cats.includes("drinks")) cats.push("drinks");
    } else {
      if (!cats.includes("drinks")) cats.push("drinks");
    }
  } else if (isDrinks && !cats.length) {
    cats.push("drinks");
  }

  if (isCoffee && !cats.includes("coffee")) {
    cats.push("coffee");
  }

  // Fallback
  if (!cats.length) {
    if (lists.includes("vegan")) cats.push("lunch");
    else cats.push("lunch");
  }

  // Enforce boats is never in categories
  return cats.filter((c) => c !== "boats");
}

async function searchGooglePlace(query) {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types," +
        "places.rating,places.userRatingCount,places.regularOpeningHours,places.addressComponents,places.photos",
    },
    body: JSON.stringify({
      textQuery: `${query} Amsterdam`,
      locationBias: {
        circle: {
          center: { latitude: AMSTERDAM_CENTER.lat, longitude: AMSTERDAM_CENTER.lng },
          radius: 15000,
        },
      },
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    throw new Error(`Places text search error: ${res.status}`);
  }
  const body = await res.json();
  return body.places?.[0] || null;
}

async function fetchAndStorePhoto(photoName) {
  if (skipPhotos || !photoName) return null;
  try {
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=1000&key=${googleKey}`
    );
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType === "image/png" ? "png" : "jpg";
    const filePath = `google-places/${randomUUID()}.${ext}`;

    const { error } = await db.storage.from(PHOTO_BUCKET).upload(filePath, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn(`Photo upload error: ${error.message}`);
      return null;
    }
    const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`Photo download failed: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("=== FreeDam Tours Places Enrichment & Import ===");
  if (dryRun) console.log("DRY RUN MODE — no database changes will be written.\n");

  // 1. Get FreeDam Tours company
  const { data: company, error: coErr } = await db
    .from("companies")
    .select("id, name")
    .ilike("name", "FreeDam Tours")
    .maybeSingle();

  if (coErr || !company) {
    console.error("FreeDam Tours company not found!", coErr);
    process.exit(1);
  }
  console.log(`Company found: ${company.name} (${company.id})`);

  // 2. Read scraped listings
  const scrapedDataPath = path.resolve("scripts/data/freedam-maps-scraped.json");
  if (!fs.existsSync(scrapedDataPath)) {
    console.error(`Scraped file missing: ${scrapedDataPath}. Run scrape script first.`);
    process.exit(1);
  }
  const rawData = JSON.parse(fs.readFileSync(scrapedDataPath, "utf8"));

  // 3. Deduplicate listings
  const itemsMap = new Map();
  for (const list of rawData) {
    for (const item of list.items) {
      const k = norm(item.title);
      if (!itemsMap.has(k)) {
        itemsMap.set(k, {
          title: item.title,
          lists: [list.list],
          bodies: [item.body],
          allText: item.allText,
        });
      } else {
        const e = itemsMap.get(k);
        if (!e.lists.includes(list.list)) e.lists.push(list.list);
        e.bodies.push(item.body);
        e.allText += " " + item.allText;
      }
    }
  }

  // Add extra Sergio favourites
  for (const extra of EXTRA_SERGIO_PLACES) {
    const k = norm(extra.title);
    if (!itemsMap.has(k)) {
      itemsMap.set(k, {
        title: extra.title,
        lists: extra.lists,
        bodies: [extra.body],
        allText: extra.body,
      });
    }
  }

  const uniqueItems = Array.from(itemsMap.values()).slice(0, limit);
  console.log(`Processing ${uniqueItems.length} unique items (limit: ${limit === Infinity ? "all" : limit})...\n`);

  // 4. Fetch existing FreeDam recommendations to merge/preserve notes
  const { data: existingRecs } = await db
    .from("recommendations")
    .select("id, name, note, photos")
    .eq("company_id", company.id);

  let successCount = 0;
  let failCount = 0;
  const toUpsert = [];

  for (let i = 0; i < uniqueItems.length; i++) {
    const item = uniqueItems[i];
    process.stdout.write(`[${i + 1}/${uniqueItems.length}] ${item.title}... `);

    try {
      const place = await searchGooglePlace(item.title);
      if (!place || !place.location) {
        console.log("NOT FOUND on Google Places.");
        failCount++;
        continue;
      }

      const placeName = place.displayName?.text || item.title;
      const address = place.formattedAddress || "";
      const area = guessArea(place.addressComponents);
      const lat = place.location.latitude;
      const lng = place.location.longitude;
      const types = place.types || [];
      const rating = place.rating || null;
      const reviewCount = place.userRatingCount || null;
      const hours = cleanOpeningHours(place.regularOpeningHours?.weekdayDescriptions);

      const categories = determineCategories(item.lists, types, placeName, item.allText);
      const cuisines = determineCuisines(types, placeName, item.lists, item.allText);

      // Check existing note
      const existing = (existingRecs || []).find((r) => norm(r.name) === norm(placeName));
      const note = existing?.note || getSergioNote(placeName, area, categories, cuisines);

      // Photo handling
      let photos = existing?.photos || [];
      if (!photos.length && place.photos?.length && !skipPhotos && !dryRun) {
        const photoUrl = await fetchAndStorePhoto(place.photos[0].name);
        if (photoUrl) photos = [photoUrl];
      }

      toUpsert.push({
        id: existing?.id || randomUUID(),
        company_id: company.id,
        owner_type: "company",
        name: placeName,
        categories,
        cuisine_types: cuisines,
        area,
        address,
        lat,
        lng,
        note,
        hours,
        photos,
        google_rating: rating,
        google_review_count: reviewCount,
        visible: true,
      });

      console.log(`OK! [Cats: ${categories.join(",")}] [Tags: ${cuisines.join(",")}]`);
      successCount++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nEnrichment complete. Successfully prepared: ${toUpsert.length}, Failed: ${failCount}`);

  if (dryRun) {
    console.log("\nDRY RUN complete. Sample record to be inserted:");
    console.log(JSON.stringify(toUpsert.slice(0, 3), null, 2));
    return;
  }

  // 5. Batch upsert to recommendations table
  console.log(`\nUpserting ${toUpsert.length} recommendations to database...`);
  const chunkSize = 25;
  for (let i = 0; i < toUpsert.length; i += chunkSize) {
    const chunk = toUpsert.slice(i, i + chunkSize);
    const { error } = await db.from("recommendations").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`Error saving chunk ${i / chunkSize + 1}:`, error.message);
    } else {
      console.log(`Saved batch ${i + 1} - ${Math.min(i + chunkSize, toUpsert.length)}`);
    }
  }

  console.log("\nAll recommendations saved successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
