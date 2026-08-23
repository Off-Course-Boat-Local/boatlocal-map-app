-- A `booking.cancelled` outcome must net against its matching
-- `booking.confirmed` one wherever a "tours booked" style metric sums the
-- `booking_outcome` event type — previously a cancellation (same event_type
-- as a confirmation, distinguished only by `metadata->>'event'`) counted as
-- an EQUALLY WEIGHTED addition to that sum instead of reducing it, so a
-- cancelled booking silently inflated every "tours booked"/conversion-rate
-- number that reads through these RPCs (src/lib/admin/analytics.ts's
-- platformEffectiveness — the only place that still sums booking_outcome
-- after this change; see 20260823220000_restrict_booking_outcome_events_rls.sql
-- for why company/guide no longer see this event type at all).
--
-- Fixed by summing +1 for a confirmed outcome and -1 for a cancelled one,
-- for booking_outcome rows only — every other event_type keeps a plain
-- count(*). This nets to the exact same grand total as explicitly pairing
-- rows by `metadata->>'bookingId'` and zeroing out each matched pair, since
-- addition is commutative: (# confirmed) - (# cancelled) across a group
-- equals the sum, across every distinct booking id in that group, of that
-- id's own confirmed-minus-cancelled count. No join or extra grouping by
-- booking id is needed to get the right aggregate answer.
--
-- This ships together with a src/lib/data/source.ts change:
-- recordBookingOutcome now dedupes on (bookingId, event) instead of
-- bookingId alone. Deduping on bookingId alone meant a genuine cancellation
-- of an already-confirmed booking was silently dropped as a "duplicate
-- delivery" of the confirmed row and never even reached this aggregate —
-- both sides of that gap are fixed in the same change.
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
  group by c.id, c.name, e.event_type;
$$;

grant execute on function public.admin_platform_analytics(timestamptz, timestamptz) to authenticated;
