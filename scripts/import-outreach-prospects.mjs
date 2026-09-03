// Seeds/updates outreach_prospects from the TripAdvisor-enrichment research
// CSV (scripts/data/amsterdam-tour-operators.csv by default). Safe to
// re-run: upserts on `name` (unique — see the migration's own comment), and
// only ever writes the enrichment columns below, never status/
// next_action_type/next_action_due_at/company_id — so re-importing an
// updated CSV refreshes ratings/contact info without resetting outreach
// progress already made on existing prospects.
//
// Usage: node --env-file=.env.local scripts/import-outreach-prospects.mjs [path/to.csv]
//
// Same service-role connection pattern as scripts/verify-db.mjs (reads
// .env.local by hand rather than assuming --env-file was passed, so this
// still works if invoked without it).

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const csvPath = process.argv[2] ?? new URL("./data/amsterdam-tour-operators.csv", import.meta.url).pathname;

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const env = Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1)];
        }),
    );
    for (const [k, v] of Object.entries(env)) process.env[k] ??= v;
  } catch {
    // No .env.local — fine if the caller already exported real env vars.
  }
}

/** Minimal RFC 4180 CSV parser — handles quoted fields containing commas
 *  ("English, German, Spanish") and escaped quotes (""), which the built-in
 *  research CSV both use. No dependency added for one parse. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toNumber(value) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

function nullIfBlank(value) {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const csvText = fs.readFileSync(csvPath, "utf8");
const [header, ...dataRows] = parseCsv(csvText);
const col = (row, name) => row[header.indexOf(name)];

let skipped = 0;
const records = [];

for (const row of dataRows) {
  const enrichmentStatus = (col(row, "Enrichment Status") ?? "").trim();
  const name = nullIfBlank(col(row, "Name"));
  if (!name) continue;
  if (enrichmentStatus.toUpperCase().includes("EXCLUDE")) {
    console.log(`Skipping "${name}" — ${enrichmentStatus}`);
    skipped++;
    continue;
  }

  const notesParts = [
    nullIfBlank(col(row, "Notes")),
    enrichmentStatus && enrichmentStatus !== "Fully Enriched" ? `Enrichment: ${enrichmentStatus}` : null,
    nullIfBlank(col(row, "Booking Platforms")) ? `Booking via: ${col(row, "Booking Platforms").trim()}` : null,
    nullIfBlank(col(row, "LinkedIn URL")) ? `LinkedIn: ${col(row, "LinkedIn URL").trim()}` : null,
    nullIfBlank(col(row, "Facebook URL")) ? `Facebook: ${col(row, "Facebook URL").trim()}` : null,
  ].filter(Boolean);

  records.push({
    name,
    website: nullIfBlank(col(row, "Website")),
    phone: nullIfBlank(col(row, "Phone")),
    email: nullIfBlank(col(row, "Email")),
    contact_name: nullIfBlank(col(row, "Owner / Contact Name")),
    instagram_handle: nullIfBlank(col(row, "Instagram Handle")),
    instagram_followers: toInt(col(row, "Instagram Followers")),
    ta_rating: toNumber(col(row, "TA Rating")),
    ta_review_count: toInt(col(row, "Review Count")),
    ta_url: nullIfBlank(col(row, "TA URL")),
    tour_type: nullIfBlank(col(row, "Tour Type")),
    price_from: toNumber(col(row, "Price From (EUR)")),
    year_founded: toInt(col(row, "Year Founded")),
    languages: nullIfBlank(col(row, "Languages Served")),
    notes: notesParts.length > 0 ? notesParts.join(" · ") : null,
  });
}

console.log(`Parsed ${records.length} prospect(s), skipped ${skipped}.`);

const { data, error } = await supabase
  .from("outreach_prospects")
  .upsert(records, { onConflict: "name" })
  .select("id, name");

if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

console.log(`Upserted ${data.length} row(s).`);
