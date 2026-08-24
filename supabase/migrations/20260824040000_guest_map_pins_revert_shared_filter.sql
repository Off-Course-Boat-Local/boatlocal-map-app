-- REVERT of 20260824030000_guest_map_pins_exclude_unlocated_boats.sql —
-- that migration filtered the SHARED guest_map_pins RPC, which is exactly
-- wrong: src/app/(guest)/list/page.tsx also calls this same function for
-- the List screen (confirmed by reading the actual page source, not
-- assumed), so excluding lat=0/lng=0 boats here silently emptied the List
-- screen too — a guest saw "0 recommendations" everywhere, not just an
-- empty map. List never reads lat/lng to render a card, so it never needed
-- this exclusion in the first place.
--
-- The real fix belongs one layer up, purely on the client: GuestMapScreen
-- derives a `mappablePins` array (filtering out the lat=0/lng=0 sentinel)
-- ONLY for what gets passed to <MapPins> for actual marker placement —
-- `allPins`/the category-filtered `pins` used for the header count and
-- everything else stays the full, unfiltered set. See that component and
-- src/lib/data/source.ts's getMapPins (also reverted to unfiltered here) for
-- the corrected home of this rule.
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
  'Guest-facing pin feed for one tenant: featured active boat tours (boats always first, per product decision that the booking business model must never be buried) unioned with visible recommendations. Used by BOTH the Map and List screens (src/app/(guest)/map/page.tsx and .../list/page.tsx) — never filter this by coordinate validity here, since List has no use for lat/lng at all; a boat tour with no real location (lat=0/lng=0, see boat_tours/syncCruiseFromBoatLocal) is excluded from actual map MARKERS client-side in GuestMapScreen.tsx, not from this feed. Shape matches src/lib/data.ts MapPin exactly so the client can swap data sources without changing component props.';
