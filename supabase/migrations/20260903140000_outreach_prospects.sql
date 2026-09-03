-- Affiliate outreach — cold-prospecting tracker, separate from `companies`.
--
-- `companies` (init_schema.sql) is for tenants who are ALREADY on the
-- platform, mid-onboarding or live. These rows are the opposite end of the
-- funnel: candidates found via research (TripAdvisor enrichment, etc.) who
-- have never heard of Map App yet. Keeping them in their own table means
-- the Companies list (admin_full_access RLS, PRD §8.3) never fills up with
-- 60+ cold leads who may never reply — a prospect only becomes a `companies`
-- row once it is deliberately onboarded (see company_id below).
--
-- Admin-only, end to end — no guest or company/guide actor ever touches
-- this data, so both tables get exactly one RLS policy each, mirroring
-- companies' own "admin_full_access" (rls_policies.sql).

create table public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  -- Unique so scripts/import-outreach-prospects.mjs can upsert on name and
  -- be safely re-run (re-importing an updated CSV updates enrichment
  -- fields on existing rows instead of creating duplicates) without a
  -- separate "have we seen this one before" lookup step.
  name text not null unique,

  -- Enrichment fields, 1:1 with the TripAdvisor research CSV this table was
  -- seeded from (scripts/import-outreach-prospects.mjs). All nullable: the
  -- CSV itself has partially-enriched rows, and a prospect added by hand
  -- later may only ever have a name + email.
  website text,
  phone text,
  email text,
  contact_name text,
  instagram_handle text,
  instagram_followers integer,
  ta_rating numeric,
  ta_review_count integer,
  ta_url text,
  tour_type text,
  price_from numeric,
  year_founded integer,
  languages text,
  notes text,

  -- Coarse pipeline stage. Deliberately NOT split into finer states like
  -- "reminder_due" / "call_due" — those are a function of next_action_*
  -- below (whether it's overdue), not a stage this row sits in, so tracking
  -- them as separate status values would just be two sources of truth that
  -- can drift.
  status text not null default 'not_contacted'
    check (status in ('not_contacted', 'emailed', 'replied', 'declined', 'onboarded')),

  -- What's next and when. Both null once status is 'replied' / 'declined' /
  -- 'onboarded' — there is nothing left to chase. The daily reminder cron
  -- (src/app/api/cron/outreach-reminders/route.ts) is the only reader that
  -- cares about next_action_due_at; everything else is for the admin UI.
  next_action_type text
    check (next_action_type in ('email_reminder', 'call')),
  next_action_due_at timestamptz,
  last_contacted_at timestamptz,

  -- Set once this prospect is onboarded as a real tenant (outreachActions.ts
  -- onboardProspectAction, which calls the existing createCompany). ON
  -- DELETE SET NULL rather than CASCADE/RESTRICT: if the company is later
  -- deleted from Admin (CompanyRowActions' own delete flow), the outreach
  -- history that led to it is still worth keeping, just no longer linked.
  company_id uuid references public.companies(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only timeline per prospect: every email sent, call logged, reply
-- noted, and free-form note. This is what the detail page renders as a
-- history, and it's the audit trail for "did we actually reach out, and
-- when" that a status column alone can't answer once someone asks six
-- months from now.
create table public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.outreach_prospects(id) on delete cascade,
  event_type text not null
    check (event_type in ('note', 'email_sent', 'call_logged', 'replied', 'declined', 'onboarded')),
  -- Email subject+body snippet, a call note, a free-form note, or a short
  -- system-generated description ("Marked declined") — always human-
  -- readable, never structured data another feature depends on parsing.
  body text,
  created_at timestamptz not null default now()
);

create index outreach_events_prospect_id_idx on public.outreach_events (prospect_id, created_at);
create index outreach_prospects_next_action_due_at_idx
  on public.outreach_prospects (next_action_due_at)
  where next_action_due_at is not null;

alter table public.outreach_prospects enable row level security;
alter table public.outreach_events enable row level security;

create policy "admin_full_access" on public.outreach_prospects
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "admin_full_access" on public.outreach_events
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create trigger outreach_prospects_set_updated_at before update on public.outreach_prospects
  for each row execute function public.set_updated_at();
