-- BoatLocal's catalogue feed is adding a per-cruise `departure` object
-- (lat/lng/address/source — confirmed shipping to their staging first, not
-- yet in their production feed as of this migration; see docs/attribution.md)
-- that src/lib/data/source.ts's syncCruiseFromBoatLocal now consumes to
-- populate `boat_tours.area`/`lng`/`lat` directly instead of leaving them at
-- the old `""`/`0`/`0` placeholder for a newly-synced cruise. This column
-- records WHICH of BoatLocal's two confidence levels that data came from:
--
--   - "google_maps_link": an operator-pinned Google Maps link — high
--     confidence.
--   - "geocoded_address": geocoded from free text on BoatLocal's side —
--     slightly lower confidence, still real, still per-cruise.
--
-- Kept as plain nullable text, not a check-constrained enum, matching this
-- table's existing `deactivation_reason` convention for an open-ended,
-- partner-supplied value Map App doesn't branch behavior on today — no
-- Admin UI reads this yet, but it's queryable from day one so a future
-- confidence indicator is a read of existing data, not a backfill (same
-- rationale as `boatlocal_updated_at` in
-- 20260823200000_boatlocal_catalog_sync.sql). Null for an admin-curated tour,
-- and for a BoatLocal-sourced one where neither `departure` nor an admin has
-- ever supplied a location.
--
-- IMPORTANT, and the reason this is a schema-only migration: real departure
-- coordinates never auto-publish a cruise by themselves. The founder's
-- explicit instruction: "don't auto-publish on departure != null alone — a
-- guide's personal note is still yours to write." The "hidden pending
-- completion" gate in syncCruiseFromBoatLocal changes from `area === ''` to
-- `note === ''` in the same application-layer change this migration ships
-- alongside — no SQL change needed for that, since `status`/`note` were
-- already writable columns; this migration is only adding the new confidence
-- column and its comment.
alter table public.boat_tours
  add column location_source text;

comment on column public.boat_tours.location_source is
  'Which of BoatLocal''s departure.source confidence levels ("google_maps_link" | "geocoded_address") the current area/lng/lat came from, if any — null for an admin-curated tour or a BoatLocal-sourced one with no location data yet. Set once, at the same moment area/lng/lat are first backfilled from a real departure (see syncCruiseFromBoatLocal in src/lib/data/source.ts); never touched again after that, same as area/lng/lat themselves.';
