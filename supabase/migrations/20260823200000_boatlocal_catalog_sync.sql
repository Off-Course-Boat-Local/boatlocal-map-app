-- BoatLocal becomes the boat_tours catalog's source of truth for identity/
-- lifecycle data (docs/attribution.md's "cruise catalogue sync" section).
-- Map App no longer builds a booking URL from a fixed base + tour id — it
-- gets a ready-to-use `booking_url` per cruise from BoatLocal's own
-- `GET /api/public/cruises` feed (and matching `cruise.activated` /
-- `cruise.deactivated` webhooks) and just appends its own tracking params to
-- it. `booking_url` already exists (`text not null`) and keeps being written
-- verbatim from whatever BoatLocal returns — no new column needed for it.
--
-- Three real identifiers exist per cruise on BoatLocal's side, only two of
-- which are ever routable — see src/lib/data/source.ts's
-- syncCruiseFromBoatLocal for the full mapping:
--   - `id` (BoatLocal's internal PK) -> boatlocal_id: reference/dedup only,
--     NEVER used to build a URL (BoatLocal confirmed this always 404s).
--   - `fareharbor_pk` -> the primary upsert key (routable, 301s to the slug
--     URL) — unique when present, since it's the real-world identity a sync
--     pass keys off.
--   - `slug` -> the canonical routable identifier, stored for reference/
--     display; not used as an upsert key itself (fareharbor_pk is BoatLocal's
--     own stated stable id for this).
--
-- Every column below is nullable: an admin-curated tour that was never
-- synced from BoatLocal (and every tour that exists today) must keep working
-- exactly as before, with these columns simply empty.
alter table public.boat_tours
  add column boatlocal_id text,
  add column fareharbor_pk integer,
  add column slug text,
  add column cruise_type text,
  -- BoatLocal's own raw active flag from the catalogue/webhook payload,
  -- deliberately kept distinct from this table's pre-existing `status`
  -- ('active' | 'hidden') text column: `status` is Map App's own
  -- catalog-visibility switch (also settable by an admin directly, e.g. via
  -- BoatTourForm, for a tour BoatLocal never sourced), while `active` is
  -- purely a record of what BoatLocal last told us. For a BoatLocal-sourced
  -- row (fareharbor_pk is not null), a sync/webhook pass drives `status` off
  -- of this column (see syncCruiseFromBoatLocal); for an admin-curated row
  -- (fareharbor_pk is null), this column is simply never touched.
  add column active boolean,
  -- From `cruise.deactivated`'s `reason` field ("admin_disabled" |
  -- "removed_from_fareharbor"), or "removed_from_fareharbor" when a
  -- reconciliation pass infers a deactivation because the cruise no longer
  -- appears in the full catalogue re-fetch (see reconcileBoatLocalCatalog).
  -- Stored as plain data only — whether Map App should ever treat the two
  -- reasons differently (e.g. hide vs. fully remove) is an explicitly open
  -- question between the two teams; see docs/attribution.md. Do not add
  -- behavior keyed off this column without that question being answered.
  add column deactivation_reason text,
  -- The catalogue/webhook payload's own `updated_at`, so a reconciliation
  -- pass can eventually tell "this row is already current" from "this row
  -- genuinely changed on BoatLocal's side" without re-deriving that from our
  -- own `updated_at` (which changes on every write regardless of source).
  -- Not yet used to skip redundant writes — reconciliation always re-upserts
  -- every returned cruise for now — but recorded from day one so that
  -- optimization is a read of existing data later, not a backfill.
  add column boatlocal_updated_at timestamptz;

comment on column public.boat_tours.boatlocal_id is
  'BoatLocal''s internal PK for this cruise. Reference/dedup only — never routable, always 404s. Do not build a URL from it.';
comment on column public.boat_tours.fareharbor_pk is
  'BoatLocal''s FareHarbor identifier for this cruise — routable (301s to the slug URL) and this table''s upsert key for BoatLocal-sourced rows.';
comment on column public.boat_tours.slug is
  'BoatLocal''s canonical routable identifier for this cruise, for reference/display.';

-- At most one row per fareharbor_pk / slug, but only among rows that HAVE
-- one — same partial-unique-index pattern as
-- 20260823190000_platform_default_company.sql's platform-default flag, for
-- the same reason: every admin-curated row leaves these null, and there's no
-- limit on how many rows can share "no identifier yet".
create unique index boat_tours_fareharbor_pk_key
  on public.boat_tours (fareharbor_pk)
  where fareharbor_pk is not null;

create unique index boat_tours_slug_key
  on public.boat_tours (slug)
  where slug is not null;

-- No RLS policy changes: these are plain columns on an already-RLS-enabled
-- table (supabase/migrations/20260805063611_rls_policies.sql) whose existing
-- policies are table-wide, not column-wide. The new sync/reconciliation
-- code path (src/lib/data/source.ts's syncCruiseFromBoatLocal/
-- reconcileBoatLocalCatalog) runs with no Studio session at all (it's driven
-- by an HMAC-verified webhook call or a cron job, neither of which is an
-- `authenticated` Postgres role) and so uses the service-role client, same
-- as findAttributedClick/recordBookingOutcome already do for the same
-- reason — RLS is bypassed there by design, not a gap.
