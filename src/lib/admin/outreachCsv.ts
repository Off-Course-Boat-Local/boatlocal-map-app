// Affiliate outreach — CSV parsing shared by the admin UI's "Import CSV"
// button (OutreachImportForm.tsx -> outreachActions.ts importOutreachCsvAction)
// and, in spirit, scripts/import-outreach-prospects.mjs: same RFC 4180
// parser, same column mapping, same EXCLUDE/notes rules. The script keeps
// its OWN copy rather than importing this module — it runs via plain
// `node`, no TypeScript/build step, exactly per its own "no dependency
// added for one parse" comment — so this file and that script are two
// implementations of one contract. Change one, change the other.

import type { OutreachCsvRecord, OutreachSegment, OutreachSource } from "@/lib/data/outreach";
import { normalizeWebsiteDomain } from "./websiteDomain";

const VALID_SEGMENTS: OutreachSegment[] = ["operator", "hotel", "agency"];

/** Minimal RFC 4180 CSV parser — handles quoted fields containing commas
 *  ("English, German, Spanish") and escaped quotes (""). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

function toNumber(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toInt(value: string | undefined): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

function nullIfBlank(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export interface ParsedOutreachCsv {
  records: OutreachCsvRecord[];
  /** Names skipped because their "Enrichment Status" column contained EXCLUDE. */
  skippedNames: string[];
}

export interface ParseOutreachCsvOptions {
  /** Segment for rows with no (or an invalid) "Segment" column value. */
  defaultSegment?: OutreachSegment;
  /** Always the same for every row in one parse — set by the caller, not read from the file (see this file's header comment on why Source isn't a CSV column). */
  source?: OutreachSource;
}

/**
 * Maps the research CSV's rows to outreach_prospects upsert records.
 * Rows with no Name, or an "Enrichment Status" containing EXCLUDE, are
 * skipped — mirrors scripts/import-outreach-prospects.mjs exactly (see
 * this file's own header comment).
 *
 * "Segment" is an OPTIONAL per-row CSV column (falls back to
 * `defaultSegment`) because a research file can mix hotels and operators;
 * "Source" is deliberately NOT a column — it describes which code path
 * did the importing (the admin's CSV button vs. the funnel-refill
 * routine's API endpoint), not something the file itself would know.
 */
export function parseOutreachCsv(text: string, options: ParseOutreachCsvOptions = {}): ParsedOutreachCsv {
  const defaultSegment = options.defaultSegment ?? "operator";
  const source = options.source ?? "csv";

  const [header, ...dataRows] = parseCsv(text);
  if (!header) return { records: [], skippedNames: [] };

  const col = (row: string[], name: string) => row[header.indexOf(name)];

  const records: OutreachCsvRecord[] = [];
  const skippedNames: string[] = [];

  for (const row of dataRows) {
    const enrichmentStatus = (col(row, "Enrichment Status") ?? "").trim();
    const name = nullIfBlank(col(row, "Name"));
    if (!name) continue;
    if (enrichmentStatus.toUpperCase().includes("EXCLUDE")) {
      skippedNames.push(name);
      continue;
    }

    const notesParts = [
      nullIfBlank(col(row, "Notes")),
      enrichmentStatus && enrichmentStatus !== "Fully Enriched" ? `Enrichment: ${enrichmentStatus}` : null,
      nullIfBlank(col(row, "Booking Platforms")) ? `Booking via: ${col(row, "Booking Platforms").trim()}` : null,
      nullIfBlank(col(row, "LinkedIn URL")) ? `LinkedIn: ${col(row, "LinkedIn URL").trim()}` : null,
      nullIfBlank(col(row, "Facebook URL")) ? `Facebook: ${col(row, "Facebook URL").trim()}` : null,
    ].filter((part): part is string => Boolean(part));

    const rawSegment = nullIfBlank(col(row, "Segment"))?.toLowerCase() ?? null;
    const segment = (VALID_SEGMENTS as string[]).includes(rawSegment ?? "")
      ? (rawSegment as OutreachSegment)
      : defaultSegment;
    const website = nullIfBlank(col(row, "Website"));

    records.push({
      name,
      segment,
      source,
      website,
      website_domain: normalizeWebsiteDomain(website),
      google_place_id: nullIfBlank(col(row, "Google Place ID")),
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

  return { records, skippedNames };
}
