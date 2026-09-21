-- Adds cuisine_types array to recommendations, allowing tour operators and
-- guides to specify cuisine sub-labels (e.g. Dutch, Indonesian, Italian) for
-- restaurant and food establishments.

alter table public.recommendations
  add column if not exists cuisine_types text[] not null default '{}';

comment on column public.recommendations.cuisine_types is
  'Cuisine sub-labels (e.g. Dutch, Indonesian, Italian, Street Food) assigned to this establishment. Shown to guests alongside the area and category.';

-- Recreate guest_map_pins function with cuisine_types column
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
  booking_url text,
  google_rating numeric,
  google_review_count integer,
  cuisine_types text[]
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
    bt.booking_url,
    null::numeric as google_rating,
    null::integer as google_review_count,
    array[]::text[] as cuisine_types
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
    null::text as booking_url,
    r.google_rating,
    r.google_review_count,
    r.cuisine_types
  from public.recommendations r
  where r.company_id = p_company_id and r.visible = true
  order by is_boat desc;
$$;

comment on function public.guest_map_pins is
  'Guest-facing pin feed for one tenant: featured active boat tours unioned with visible recommendations, including multi-category tags, Google rating snapshot, and cuisine sub-labels.';

grant execute on function public.guest_map_pins(uuid) to anon, authenticated;
