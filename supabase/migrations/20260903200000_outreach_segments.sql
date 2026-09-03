-- Affiliate outreach — segments + agent-sourced research, for the weekly
-- funnel-refill routine (docs/outreach-research.md). Prior to this, every
-- prospect was implicitly a tour operator, seeded once by hand from a CSV.
-- This adds: which kind of partner a row is (the pitch differs — a hotel
-- gets a free app, an operator gets distribution), where it came from (so
-- the admin list can show "new this week" from the agent vs. the original
-- hand-seeded batch), and enough Google Places identity to dedupe a
-- re-discovered place without relying on `name` matching exactly, which is
-- too weak for hotels ("Hotel V" vs "Hotel V Nesplein").

alter table public.outreach_prospects
  add column segment text not null default 'operator'
    check (segment in ('operator', 'hotel', 'agency')),
  add column source text not null default 'csv'
    check (source in ('csv', 'agent')),
  add column google_place_id text,
  add column website_domain text;

comment on column public.outreach_prospects.ta_rating is
  'The review platform''s own rating for this segment — TripAdvisor for operators (this table''s original use), Google for hotels/B&Bs sourced via the research routine (docs/outreach-research.md). Column name kept as ta_rating rather than renamed: every operator row already in this table is genuinely TripAdvisor data, and a rename would just be churn for a value that is always "this prospect''s public rating," regardless of platform.';
comment on column public.outreach_prospects.ta_review_count is
  'See ta_rating''s own comment — same platform-agnostic reasoning.';
comment on column public.outreach_prospects.ta_url is
  'The public review-platform URL backing ta_rating (TripAdvisor listing for operators, Google Maps place URL for hotels).';

-- Best-effort backfill for the 64 rows already imported by hand — strips
-- protocol/www/path so scripts/import-outreach-prospects.mjs's plain
-- "360amsterdamtours.com"-style website values and a real
-- "https://www.360amsterdamtours.com/tours" both normalize the same way.
update public.outreach_prospects
set website_domain = lower(
  split_part(
    regexp_replace(regexp_replace(website, '^[a-zA-Z]+://', ''), '^www\.', ''),
    '/', 1
  )
)
where website is not null and website_domain is null;

-- Not unique: a shared/generic domain (a booking-platform subdomain used by
-- two different small operators) is rare but possible, and this index only
-- needs to make the funnel-refill routine's "have we already got this
-- place" dedupe lookup fast, not enforce identity — google_place_id is the
-- actual strong key, deduped in application code.
create index outreach_prospects_website_domain_idx
  on public.outreach_prospects (website_domain)
  where website_domain is not null;

create index outreach_prospects_google_place_id_idx
  on public.outreach_prospects (google_place_id)
  where google_place_id is not null;
