-- Boat Local Map App — public helper functions (RPC surface)
--
-- These are distinct from the `private.*` helpers added in
-- 20260805063611_rls_policies.sql: those exist purely so RLS policies can
-- resolve "who is calling" without recursing into RLS on `profiles`. The
-- functions here are `public` schema, callable over the Data API/RPC by the
-- app, and are the query patterns the data-access interface
-- (src/lib/data/source.ts) is written against. Every one of them is
-- `security invoker` and does nothing a plain `select` under the caller's
-- own row-level security couldn't already do — they exist to keep a
-- multi-table shape (e.g. "boats + recommendations, unified") in one place
-- instead of duplicated across every caller.
--
-- All are STABLE (read-only) and safe to grant to `anon` where the
-- underlying tables already have a guest_public_read policy; grants below
-- mirror that exactly, so a function never opens up more than direct table
-- access already would.

-- ---------------------------------------------------------------------------
-- company_by_subdomain — subdomain -> brand resolution (PRD §11/§13.1).
-- ---------------------------------------------------------------------------
create or replace function public.company_by_subdomain(p_subdomain text)
returns public.companies
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.companies
  where subdomain = p_subdomain
  limit 1;
$$;

comment on function public.company_by_subdomain is
  'Resolves the tenant for a guest request''s hostname. Relies on the caller''s own RLS (guest_public_read restricts anon to status=active; admin/company see their row(s) per their own policies).';

grant execute on function public.company_by_subdomain(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- guide_by_slug — path segment -> guide resolution (PRD §13.1: guide comes
-- from the first path segment, e.g. hotelv.app.boatlocal.nl/jan).
-- ---------------------------------------------------------------------------
create or replace function public.guide_by_slug(p_company_id uuid, p_slug text)
returns public.guides
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.guides
  where company_id = p_company_id and slug = p_slug
  limit 1;
$$;

grant execute on function public.guide_by_slug(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- guest_map_pins — unifies boat_tours + recommendations into the single
-- pin shape the guest map renders (matches src/lib/data.ts `MapPin` /
-- ALL_PINS ordering: boats first, then everything else).
-- ---------------------------------------------------------------------------
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
  'Guest-facing pin feed for one tenant: featured active boat tours (boats always first, per product decision that the booking business model must never be buried) unioned with visible recommendations. Shape matches src/lib/data.ts MapPin exactly so the client can swap data sources without changing component props.';

grant execute on function public.guest_map_pins(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- company_analytics_summary / guide_analytics_summary /
-- admin_platform_analytics — rollups behind the Studio/Admin dashboards
-- (PRD §6.4, §7.1, §7.7, §8.4). Each is `security invoker`: it only ever
-- returns what the *caller's own* RLS on `events` already lets them see —
-- a guide calling company_analytics_summary for someone else's company_id
-- simply gets zero rows, because guide_select_own_events never matches.
-- ---------------------------------------------------------------------------
create or replace function public.company_analytics_summary(
  p_company_id uuid,
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (event_type public.event_type, guide_id uuid, event_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.event_type, e.guide_id, count(*) as event_count
  from public.events e
  where e.company_id = p_company_id
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
  group by e.event_type, e.guide_id;
$$;

grant execute on function public.company_analytics_summary(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.guide_analytics_summary(
  p_guide_id uuid,
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (event_type public.event_type, event_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.event_type, count(*) as event_count
  from public.events e
  where e.guide_id = p_guide_id
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
  group by e.event_type;
$$;

grant execute on function public.guide_analytics_summary(uuid, timestamptz, timestamptz) to authenticated;

-- Platform-wide (admin only, PRD §8.4). Not restricted to admin here — the
-- `admin_full_access` policy on `events` means a non-admin caller simply
-- sees nothing, same pattern as the two functions above.
create or replace function public.admin_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (company_id uuid, company_name text, event_type public.event_type, event_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id as company_id, c.name as company_name, e.event_type, count(*) as event_count
  from public.events e
  join public.companies c on c.id = e.company_id
  where e.occurred_at >= p_from and e.occurred_at < p_to
  group by c.id, c.name, e.event_type;
$$;

grant execute on function public.admin_platform_analytics(timestamptz, timestamptz) to authenticated;
