// Affiliate outreach — data-access layer for the cold-prospecting tracker
// (supabase/migrations/20260903140000_outreach_prospects.sql). Deliberately
// its OWN module, not folded into src/lib/data/source.ts: source.ts's own
// header comment makes every one of its ~31 functions carry a parallel
// isTestEnv/fakeStore branch, verified line-for-line by source.test.ts, and
// that contract is explicitly "not optional scaffolding to remove". This
// feature has no such existing test contract, so adding it here instead of
// there avoids either breaking that promise or bloating it for no reason —
// same reasoning that already put src/lib/admin/ownerInvite.ts outside
// source.ts.
//
// Admin-only, like ownerInvite.ts, but unlike it this uses the ordinary
// authenticated (anon-key + session) client, not the service-role one:
// nothing here needs to bypass RLS the way reading back an invite token
// does. RLS's "admin_full_access" policy on both tables is what actually
// enforces the admin-only role check server-side (the actor.role check
// below is belt-and-suspenders, same layering companies/guides already
// use in source.ts).

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StudioActor } from "@/lib/data/types";

export type OutreachStatus = "not_contacted" | "emailed" | "replied" | "declined" | "onboarded";
export type OutreachActionType = "email_reminder" | "call";
/**
 * What kind of partner this row is — the pitch differs per segment (a
 * hotel gets a free guest app, an operator gets distribution to hotel
 * guests; see docs/outreach-voice.md). "agency" exists in the schema for
 * the eventual travel-agency/DMC pitch but isn't sourced by anything yet.
 */
export type OutreachSegment = "operator" | "hotel" | "agency";
/** Hand-uploaded via the CSV button, or found by the weekly research routine (docs/outreach-research.md). */
export type OutreachSource = "csv" | "agent";
export type OutreachEventType =
  | "note"
  | "email_sent"
  | "call_logged"
  | "replied"
  | "declined"
  | "onboarded";

export interface OutreachProspect {
  id: string;
  name: string;
  segment: OutreachSegment;
  source: OutreachSource;
  website: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  taRating: number | null;
  taReviewCount: number | null;
  taUrl: string | null;
  tourType: string | null;
  priceFrom: number | null;
  yearFounded: number | null;
  languages: string | null;
  notes: string | null;
  status: OutreachStatus;
  nextActionType: OutreachActionType | null;
  nextActionDueAt: string | null;
  lastContactedAt: string | null;
  companyId: string | null;
  googlePlaceId: string | null;
  websiteDomain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachEvent {
  id: string;
  prospectId: string;
  eventType: OutreachEventType;
  body: string | null;
  createdAt: string;
}

// snake_case DB row -> camelCase app type, mirroring fromCompanyRow's own
// pattern in source.ts.
interface OutreachProspectRow {
  id: string;
  name: string;
  segment: OutreachSegment;
  source: OutreachSource;
  website: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  ta_rating: number | null;
  ta_review_count: number | null;
  ta_url: string | null;
  tour_type: string | null;
  price_from: number | null;
  year_founded: number | null;
  languages: string | null;
  notes: string | null;
  status: OutreachStatus;
  next_action_type: OutreachActionType | null;
  next_action_due_at: string | null;
  last_contacted_at: string | null;
  company_id: string | null;
  google_place_id: string | null;
  website_domain: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: OutreachProspectRow): OutreachProspect {
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    source: row.source,
    website: row.website,
    phone: row.phone,
    email: row.email,
    contactName: row.contact_name,
    instagramHandle: row.instagram_handle,
    instagramFollowers: row.instagram_followers,
    taRating: row.ta_rating,
    taReviewCount: row.ta_review_count,
    taUrl: row.ta_url,
    tourType: row.tour_type,
    priceFrom: row.price_from,
    yearFounded: row.year_founded,
    languages: row.languages,
    notes: row.notes,
    status: row.status,
    nextActionType: row.next_action_type,
    nextActionDueAt: row.next_action_due_at,
    lastContactedAt: row.last_contacted_at,
    companyId: row.company_id,
    googlePlaceId: row.google_place_id,
    websiteDomain: row.website_domain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireAdmin(actor: StudioActor) {
  if (actor.role !== "admin") {
    throw new Error("Only admin may access affiliate outreach.");
  }
}

/**
 * Ordered so the list reads as a queue: whatever is overdue (or due soonest)
 * floats to the top, nulls (nothing pending — not_contacted, or a closed-out
 * replied/declined/onboarded row) sink to the bottom. Postgres sorts NULLs
 * last on ascending order by default, which is exactly this.
 */
export async function listOutreachProspects(actor: StudioActor): Promise<OutreachProspect[]> {
  requireAdmin(actor);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_prospects")
    .select("*")
    .order("next_action_due_at", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as OutreachProspectRow[]).map(fromRow);
}

export async function getOutreachProspect(
  actor: StudioActor,
  id: string,
): Promise<OutreachProspect | null> {
  requireAdmin(actor);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as OutreachProspectRow) : null;
}

export async function listOutreachEvents(
  actor: StudioActor,
  prospectId: string,
): Promise<OutreachEvent[]> {
  requireAdmin(actor);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_events")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Array<{
    id: string;
    prospect_id: string;
    event_type: OutreachEventType;
    body: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    prospectId: row.prospect_id,
    eventType: row.event_type,
    body: row.body,
    createdAt: row.created_at,
  }));
}

/**
 * Every prospect whose next action is due now or earlier and isn't closed
 * out — exactly what the daily Slack reminder (outreach-reminders cron)
 * digests.
 *
 * Uses the SERVICE-ROLE client, not the authed one every other function in
 * this file uses, and takes no `actor` — deliberately, and for the same
 * reason src/lib/data/source.ts reserves the service-role client for
 * "BoatLocal's own server calling ours directly, authenticated only by the
 * HMAC signature" (attributionWebhook.ts): Vercel Cron calls this route
 * directly too, authenticated only by the CRON_SECRET bearer token the
 * route itself checks (see its own comment) — there is no signed-in admin
 * session or cookie for the ordinary authed client to read, so RLS's
 * `private.is_admin()` (which resolves off `auth.uid()`) would see no user
 * at all and return zero rows, not "unauthorized". The route's own
 * CRON_SECRET check is what stands in for requireAdmin here.
 */
export async function listDueOutreachProspects(): Promise<OutreachProspect[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("outreach_prospects")
    .select("*")
    .not("next_action_due_at", "is", null)
    .lte("next_action_due_at", new Date().toISOString())
    .order("next_action_due_at", { ascending: true });
  if (error) throw error;
  return (data as OutreachProspectRow[]).map(fromRow);
}

export interface LogOutreachEventInput {
  prospectId: string;
  eventType: OutreachEventType;
  body?: string | null;
}

export async function logOutreachEvent(
  actor: StudioActor,
  input: LogOutreachEventInput,
): Promise<void> {
  requireAdmin(actor);
  const supabase = await createClient();
  const { error } = await supabase.from("outreach_events").insert({
    prospect_id: input.prospectId,
    event_type: input.eventType,
    body: input.body ?? null,
  });
  if (error) throw error;
}

export interface UpdateOutreachProspectInput {
  status?: OutreachStatus;
  nextActionType?: OutreachActionType | null;
  nextActionDueAt?: string | null;
  lastContactedAt?: string | null;
  companyId?: string | null;
}

/**
 * The subset of outreach_prospects columns the CSV importer ever writes —
 * enrichment fields only, keyed by the DB's own snake_case (this goes
 * straight into an upsert, unlike the rest of this file's camelCase public
 * shape). Deliberately excludes status, next_action_type, next_action_due_at,
 * last_contacted_at and company_id: importing (or re-importing an updated research CSV) must
 * never reset outreach progress already made on an existing prospect — see
 * scripts/import-outreach-prospects.mjs's own header comment, which this
 * mirrors.
 */
export interface OutreachCsvRecord {
  name: string;
  segment: OutreachSegment;
  source: OutreachSource;
  website: string | null;
  website_domain: string | null;
  google_place_id: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  ta_rating: number | null;
  ta_review_count: number | null;
  ta_url: string | null;
  tour_type: string | null;
  price_from: number | null;
  year_founded: number | null;
  languages: string | null;
  notes: string | null;
}

/**
 * Upserts CSV-sourced prospects on `name` (unique — see the migration's own
 * comment), same as the standalone import script. Used by the admin UI's
 * "Import CSV" button (outreachActions.ts importOutreachCsvAction) so
 * re-running research doesn't require terminal access.
 *
 * Returns created/updated counts for the action's confirmation message —
 * computed from a pre-upsert lookup of which names already existed, since
 * `.upsert()` itself doesn't distinguish inserted rows from updated ones.
 */
async function upsertOutreachProspectsFromCsvWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  records: OutreachCsvRecord[],
): Promise<{ created: number; updated: number }> {
  if (records.length === 0) return { created: 0, updated: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("outreach_prospects")
    .select("name")
    .in(
      "name",
      records.map((r) => r.name),
    );
  if (existingError) throw existingError;
  const existingNames = new Set((existing as Array<{ name: string }>).map((r) => r.name));

  const { error } = await supabase.from("outreach_prospects").upsert(records, { onConflict: "name" });
  if (error) throw error;

  const updated = records.filter((r) => existingNames.has(r.name)).length;
  return { created: records.length - updated, updated };
}

export async function upsertOutreachProspectsFromCsv(
  actor: StudioActor,
  records: OutreachCsvRecord[],
): Promise<{ created: number; updated: number }> {
  requireAdmin(actor);
  const supabase = await createClient();
  return upsertOutreachProspectsFromCsvWithClient(supabase, records);
}

/**
 * Same upsert, via the SERVICE-ROLE client with no actor check — for the
 * funnel-refill routine's import endpoint (docs/outreach-research.md),
 * which is bearer-secret gated with no signed-in admin session. Without a
 * session, RLS's private.is_admin() sees no `auth.uid()` and would block
 * every write, not just unauthorized ones — same reasoning as
 * listDueOutreachProspects. The route's own bearer-secret check is what
 * stands in for requireAdmin here.
 */
export async function upsertOutreachProspectsFromCsvViaService(
  records: OutreachCsvRecord[],
): Promise<{ created: number; updated: number }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return upsertOutreachProspectsFromCsvWithClient(createAdminClient(), records);
}

export interface ExistingPartnerIdentifiers {
  googlePlaceIds: Set<string>;
  websiteDomains: Set<string>;
  /** Lowercased — a cheap, best-effort check; there's no shared key with `companies` (no website column there) so name is all there is. */
  prospectNames: Set<string>;
  companyNames: Set<string>;
}

/**
 * Everything the funnel-refill routine's candidates endpoint (see
 * docs/outreach-research.md) needs to skip a place we already know about —
 * either an existing prospect, or a company already onboarded. Same
 * service-role / no-actor shape as listDueOutreachProspects for the same
 * reason: the routine calls this with a bearer secret, not a signed-in
 * admin session, so there's no `auth.uid()` for RLS to key off.
 */
export async function listExistingPartnerIdentifiers(): Promise<ExistingPartnerIdentifiers> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const [prospectsResult, companiesResult] = await Promise.all([
    supabase.from("outreach_prospects").select("name, google_place_id, website_domain"),
    supabase.from("companies").select("name"),
  ]);
  if (prospectsResult.error) throw prospectsResult.error;
  if (companiesResult.error) throw companiesResult.error;

  const prospects = prospectsResult.data as Array<{
    name: string;
    google_place_id: string | null;
    website_domain: string | null;
  }>;
  const companies = companiesResult.data as Array<{ name: string }>;

  return {
    googlePlaceIds: new Set(prospects.map((r) => r.google_place_id).filter((v): v is string => Boolean(v))),
    websiteDomains: new Set(prospects.map((r) => r.website_domain).filter((v): v is string => Boolean(v))),
    prospectNames: new Set(prospects.map((r) => r.name.toLowerCase())),
    companyNames: new Set(companies.map((r) => r.name.toLowerCase())),
  };
}

export async function updateOutreachProspect(
  actor: StudioActor,
  id: string,
  input: UpdateOutreachProspectInput,
): Promise<void> {
  requireAdmin(actor);
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if ("status" in input) patch.status = input.status;
  if ("nextActionType" in input) patch.next_action_type = input.nextActionType;
  if ("nextActionDueAt" in input) patch.next_action_due_at = input.nextActionDueAt;
  if ("lastContactedAt" in input) patch.last_contacted_at = input.lastContactedAt;
  if ("companyId" in input) patch.company_id = input.companyId;

  const { error } = await supabase.from("outreach_prospects").update(patch).eq("id", id);
  if (error) throw error;
}
