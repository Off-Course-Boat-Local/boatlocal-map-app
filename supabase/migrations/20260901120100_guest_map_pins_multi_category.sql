-- Follows 20260901120000_recommendations_multi_category.sql: guest_map_pins
-- must return `categories category_id[]` instead of `category`, matching
-- the table's new shape. Boats still return a single-element array
-- (array['boats']) — a boat tour has exactly one category by product
-- design (its own dedicated table, never multi-tagged).
--
-- DROP then CREATE, not CREATE OR REPLACE: same "cannot change return type
-- of existing function" issue this function's own prior migrations already
-- document (see 20260824050000's comment).
drop function if exists public.guest_map_pins(uuid);

create function public.guest_map_pins(p_company_id uuid)
returns table (
  id uuid,
  name text,
  categories public.category_id[],
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
    array['boats']::public.category_id[] as categories,
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
    r.categories,
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
  'Guest-facing pin feed for one tenant: featured active boat tours (boats always first, per product decision that the booking business model must never be buried) unioned with visible recommendations. Used by BOTH the Map and List screens — never filter this by coordinate validity here (see this function''s prior migration comment). categories[1] is always the primary category (pin colour/icon) — see src/lib/categories.ts and MapPins.tsx. cruise_duration/starting_price_cents/price_currency are BoatLocal-owned structured fields, null for an admin-curated tour or any recommendation; the client falls back to the combined `meta` string in that case. Shape matches src/lib/data.ts MapPin exactly so the client can swap data sources without changing component props.';

grant execute on function public.guest_map_pins(uuid) to anon, authenticated;
