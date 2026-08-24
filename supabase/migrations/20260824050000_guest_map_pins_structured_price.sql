-- Adds cruise_duration/starting_price_cents/price_currency to the boat
-- branch of guest_map_pins, so the guest UI can show a boat's duration
-- (small, clock-iconed, up in the metadata row) and its price (bold, in
-- the footer) as two separate pieces of text instead of one combined
-- string — see src/lib/data/source.ts's getMapPins mapping and
-- MapPin.durationLabel/.priceLabel. `meta` stays in the return shape as
-- the combined-string fallback for an admin-curated tour that has neither
-- (those three new columns are null for anything not synced from
-- BoatLocal — see 20260824020000_boat_tours_structured_meta.sql). Places
-- have no such split, so they always return null for the three new columns.
--
-- DROP then CREATE, not CREATE OR REPLACE: Postgres refuses to replace a
-- function whose OUT-parameter row shape changes ("cannot change return
-- type of existing function") — the exact same class of issue this
-- codebase already hit once with guide_by_slug (see that function's own
-- migration comment). Adding three columns to `returns table (...)` is a
-- shape change, so the old function must be dropped first.
drop function if exists public.guest_map_pins(uuid);

create function public.guest_map_pins(p_company_id uuid)
returns table (
  id uuid,
  name text,
  category public.category_id,
  area text,
  lng double precision,
  lat double precision,
  note text,
  meta text,
  cruise_duration text,
  starting_price_cents integer,
  price_currency text,
  photos text[],
  is_boat boolean,
  booking_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    bt.id,
    bt.name,
    'boats'::public.category_id as category,
    bt.area,
    bt.lng,
    bt.lat,
    bt.note,
    bt.meta,
    bt.cruise_duration,
    bt.starting_price_cents,
    bt.price_currency,
    bt.photos,
    true as is_boat,
    bt.booking_url
  from public.boat_tours bt
  join public.company_boat_features cbf
    on cbf.boat_tour_id = bt.id and cbf.company_id = p_company_id
  where bt.status = 'active' and cbf.is_featured = true
  union all
  select
    r.id,
    r.name,
    r.category,
    r.area,
    r.lng,
    r.lat,
    r.note,
    r.hours as meta,
    null::text as cruise_duration,
    null::integer as starting_price_cents,
    null::text as price_currency,
    r.photos,
    false as is_boat,
    null::text as booking_url
  from public.recommendations r
  where r.company_id = p_company_id and r.visible = true
  order by is_boat desc;
$$;

comment on function public.guest_map_pins is
  'Guest-facing pin feed for one tenant: featured active boat tours (boats always first, per product decision that the booking business model must never be buried) unioned with visible recommendations. Used by BOTH the Map and List screens — never filter this by coordinate validity here (see this function''s prior migration comment). cruise_duration/starting_price_cents/price_currency are BoatLocal-owned structured fields, null for an admin-curated tour or any recommendation; the client falls back to the combined `meta` string in that case. Shape matches src/lib/data.ts MapPin exactly so the client can swap data sources without changing component props.';

-- DROP FUNCTION also drops its grants — the original helper_functions.sql
-- migration granted this once, but every later migration was a plain
-- CREATE OR REPLACE (which preserves grants), so this is the only place
-- since then that actually needs to re-state it.
grant execute on function public.guest_map_pins(uuid) to anon, authenticated;
