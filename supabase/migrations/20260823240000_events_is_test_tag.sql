-- BoatLocal's team has been testing their webhook integration against our
-- real PRODUCTION webhook — no staging endpoint reachable yet (blocked by
-- Vercel Deployment Protection on the `staging` branch, a dashboard-only
-- concern entirely outside this migration) — leaving behind test rows that
-- had to be manually identified by booking_id/click_id prefix convention
-- (TEST-/E2E-/STG- and bkl_TEST_/bkl_E2E_/bkl_STG_) and deleted by hand,
-- twice already in one day. Both teams agreed a proper flag replaces that
-- fragile manual convention going forward, rather than relying on parsing
-- id prefixes forever.
--
-- Set true server-side (src/lib/data/source.ts's recordEvent/
-- recordBookingOutcome, via isNonProductionDeployment) whenever an event is
-- recorded from a non-production Vercel deployment
-- (process.env.VERCEL_ENV !== "production" — Vercel sets this automatically
-- on every real deployment). NEVER derived from parsing booking_id/click_id
-- prefixes — that's exactly the convention this replaces.
--
-- This repo's staging deployments currently share the SAME database as
-- production (there is no separate staging Supabase project), so this flag
-- is the only thing distinguishing real activity from test/staging activity
-- going forward. Every analytics RPC that surfaces a booking_outcome-derived
-- count must exclude is_test=true rows by default — the same category of
-- concern 20260823210000_net_cancelled_booking_outcomes.sql (real financial
-- numbers must net cancellations correctly) and
-- 20260823220000_restrict_booking_outcome_events_rls.sql (real financial
-- numbers must stay admin-only) already changed these same three functions
-- for. Applied to every event type here, not just booking_outcome, so a
-- staging session's app_open/tip_saved/etc. counts don't pollute a company's
-- or guide's own numbers either — see recordEvent's own comment for why this
-- wasn't scoped narrower.
alter table public.events
  add column is_test boolean not null default false;

comment on column public.events.is_test is
  'True when this event was recorded from a non-production Vercel deployment (process.env.VERCEL_ENV !== ''production'' — see isNonProductionDeployment in src/lib/data/source.ts). Never derived from booking_id/click_id prefix conventions. Every analytics RPC below excludes is_test = true rows by default.';

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
  select
    e.event_type,
    e.guide_id,
    case
      when e.event_type = 'booking_outcome'
        then sum(case when e.metadata ->> 'event' = 'booking.cancelled' then -1 else 1 end)
      else count(*)
    end as event_count
  from public.events e
  where e.company_id = p_company_id
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
    and e.is_test = false
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
  select
    e.event_type,
    case
      when e.event_type = 'booking_outcome'
        then sum(case when e.metadata ->> 'event' = 'booking.cancelled' then -1 else 1 end)
      else count(*)
    end as event_count
  from public.events e
  where e.guide_id = p_guide_id
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
    and e.is_test = false
  group by e.event_type;
$$;

grant execute on function public.guide_analytics_summary(uuid, timestamptz, timestamptz) to authenticated;

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
  select
    c.id as company_id,
    c.name as company_name,
    e.event_type,
    case
      when e.event_type = 'booking_outcome'
        then sum(case when e.metadata ->> 'event' = 'booking.cancelled' then -1 else 1 end)
      else count(*)
    end as event_count
  from public.events e
  join public.companies c on c.id = e.company_id
  where e.occurred_at >= p_from and e.occurred_at < p_to
    and e.is_test = false
  group by c.id, c.name, e.event_type;
$$;

grant execute on function public.admin_platform_analytics(timestamptz, timestamptz) to authenticated;
