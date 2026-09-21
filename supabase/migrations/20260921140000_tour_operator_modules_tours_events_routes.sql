-- Tour Operator Expansion: Company Modules, Custom Operator Tours, Events, and Route Creation.

-- 1. Company Modules configuration (toggleable features like route creation)
alter table public.companies
  add column if not exists modules jsonb not null default '{"routes": false, "events": true, "custom_tours": true}'::jsonb;

comment on column public.companies.modules is
  'JSON object of enabled feature modules for this tenant, e.g. {"routes": true, "events": true, "custom_tours": true}. Configurable by the company owner in Studio.';

-- 2. Custom Operator Tours: Add company_id and tour_type to boat_tours (generalizing to tours)
create type public.tour_transport_type as enum ('boat', 'bike', 'walk', 'food', 'other');

alter table public.boat_tours
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists tour_type public.tour_transport_type not null default 'boat';

comment on column public.boat_tours.company_id is
  'When set, this tour is an operator-owned custom tour belonging exclusively to this company. When null, this is a global/catalog tour (e.g. synced from BoatLocal or admin-curated).';

comment on column public.boat_tours.tour_type is
  'The type of tour: boat, bike, walk, food, or other experience.';

-- 3. Events Table
create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz,
  venue_name text,
  address text not null,
  lng double precision not null,
  lat double precision not null,
  photos text[] not null default '{}',
  ticket_url text,
  price_label text, -- e.g. "Free", "€15", "From €25"
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_events is
  'Company-curated events with a physical location, schedule, and optional ticket/booking link.';

-- 4. Routes & Route Stops
create type public.route_transport_mode as enum ('bike', 'walk', 'boat', 'drive');

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  slug text,
  transport_mode public.route_transport_mode not null default 'bike',
  summary text not null default '',
  description text not null default '',
  duration_minutes integer,
  distance_meters integer,
  polyline text, -- Encoded polyline or GeoJSON path
  photos text[] not null default '{}',
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  title text not null,
  description text not null default '',
  lng double precision not null,
  lat double precision not null,
  address text not null default '',
  photos text[] not null default '{}',
  stop_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. RLS Policies for new tables
alter table public.company_events enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

-- Events RLS
create policy events_anon_select on public.company_events
  for select to anon, authenticated
  using (is_published = true);

create policy events_company_all on public.company_events
  for all to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));

-- Routes RLS
create policy routes_anon_select on public.routes
  for select to anon, authenticated
  using (is_published = true);

create policy routes_company_all on public.routes
  for all to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));

-- Route stops RLS
create policy route_stops_anon_select on public.route_stops
  for select to anon, authenticated
  using (route_id in (select id from public.routes where is_published = true));

create policy route_stops_company_all on public.route_stops
  for all to authenticated
  using (route_id in (
    select r.id from public.routes r
    join public.profiles p on p.company_id = r.company_id
    where p.id = auth.uid()
  ))
  with check (route_id in (
    select r.id from public.routes r
    join public.profiles p on p.company_id = r.company_id
    where p.id = auth.uid()
  ));

-- 6. Update guest_map_pins RPC to return operator-owned custom tours as well
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
  -- 1. Featured global boat tours
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
  where bt.status = 'active' and cbf.is_featured = true and bt.company_id is null
  union all
  -- 2. Company-owned custom tours (bike tours, walking tours, custom boat trips)
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
  where bt.status = 'active' and bt.company_id = p_company_id
  union all
  -- 3. Regular recommendations
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

grant execute on function public.guest_map_pins(uuid) to anon, authenticated;
