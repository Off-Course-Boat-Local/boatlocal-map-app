-- REGRESSION FIX, found live on production 2026-08-24: every one of the 61
-- BoatLocal-synced boat_tours rows carries the lat=0/lng=0 sentinel this
-- table's NOT NULL columns force syncCruiseFromBoatLocal to write when
-- BoatLocal's feed supplies no `cruise.departure` (see that function's own
-- doc comment in src/lib/data/source.ts — the feed genuinely has no
-- location field in production yet, confirmed directly against
-- https://boatlocal.nl/api/public/cruises; this is not a parsing bug on our
-- side). guest_map_pins was plotting every one of those cruises at 0,0 —
-- off the coast of West Africa, nowhere near an Amsterdam-centred map — so
-- guests saw zero boat pins despite the List screen correctly showing all
-- twelve (List never needed real coordinates to render a card).
--
-- Fix: exclude the 0,0 sentinel from the MAP feed only. List/getBoatTours
-- are untouched — a cruise with no real departure data is still a
-- perfectly valid recommendation to book, it just can't be placed on a map
-- until BoatLocal ships `departure` for real. The exact "never geocode
-- ourselves" rule this respects: no invented coordinate is substituted, the
-- pin simply doesn't exist until real data does.
create or replace function public.guest_map_pins(p_company_id uuid)
returns table (
  id uuid,
  name text,
  category public.category_id,
  area text,
  lng double precision,
  lat double precision,
  note text,
  meta text,
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
    bt.photos,
    true as is_boat,
    bt.booking_url
  from public.boat_tours bt
  join public.company_boat_features cbf
    on cbf.boat_tour_id = bt.id and cbf.company_id = p_company_id
  where bt.status = 'active' and cbf.is_featured = true
    and not (bt.lat = 0 and bt.lng = 0)
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
    r.photos,
    false as is_boat,
    null::text as booking_url
  from public.recommendations r
  where r.company_id = p_company_id and r.visible = true
  order by is_boat desc;
$$;

comment on function public.guest_map_pins is
  'Guest-facing pin feed for one tenant: featured active boat tours with a
   real location (boats always first, per product decision that the booking
   business model must never be buried) unioned with visible recommendations.
   A boat tour synced from BoatLocal with no cruise.departure data yet sits
   at the lat=0/lng=0 sentinel (see boat_tours table, syncCruiseFromBoatLocal)
   and is deliberately excluded here — it still appears in the List screen via
   getBoatTours, just not on the map, until BoatLocal supplies a real location.
   Shape matches src/lib/data.ts MapPin exactly so the client can swap data
   sources without changing component props.';
