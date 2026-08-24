-- BoatLocal's catalogue feed (`GET /api/public/cruises`) now serves a
-- `headline` per cruise — real one-line marketing copy like "BYO Drinks
-- Welcome • Small Group • Hidden Canal Routes" (all 61 current cruises have
-- one). syncCruiseFromBoatLocal (src/lib/data/source.ts) now records it here
-- on EVERY sync, and seeds/refreshes the row's guest-facing `note` from it —
-- but only while the note is still BoatLocal-owned:
--
--   - `note` starts as a copy of the headline (or "" when BoatLocal has
--     none) and remains admin-editable, exactly as before.
--   - A sync overwrites `note` with the latest headline ONLY when the
--     current note is empty, equals the previously-recorded value of this
--     column, or equals the incoming headline itself (that last comparison
--     is what lets the 2026-08-24 one-time backfill — which set note =
--     headline before this column existed — be adopted as BoatLocal-owned
--     instead of being mistaken for admin copy forever).
--   - The moment an admin writes their own note, it no longer matches this
--     column and is never touched by a sync again.
--
-- Nullable like every other BoatLocal column on this table: admin-curated
-- tours (fareharbor_pk is null) never get one, and BoatLocal-sourced rows
-- synced before this column existed hold null until their next sync.
alter table public.boat_tours
  add column boatlocal_headline text;

comment on column public.boat_tours.boatlocal_headline is
  'BoatLocal''s own one-line marketing headline for this cruise, recorded on every sync. `note` starts as a copy of it and remains admin-editable — a sync only refreshes `note` while it still matches this column (or is empty); see syncCruiseFromBoatLocal in src/lib/data/source.ts.';
