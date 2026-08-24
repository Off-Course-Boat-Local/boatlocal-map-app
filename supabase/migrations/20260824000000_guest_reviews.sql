-- Guest-submitted star rating for the Review screen (PRD §5.6), plus the
-- optional free-text feedback + contact that goes with it on the
-- private-feedback path (src/components/guest/GuestReviewScreen.tsx).
--
-- Product decision (negotiated after an FTC/Google-policy review-gating
-- concern was flagged): the star rating only ever changes which of the two
-- share options — public review link vs. private feedback — is shown with
-- visual EMPHASIS. Both stay rendered and fully clickable at every rating,
-- including before any star is picked. This table exists purely to give
-- that rating somewhere real to be recorded; it has no bearing on what the
-- guest sees.
--
-- ONE ROW PER MEANINGFUL INTERACTION, not one row per "review session" —
-- there is no guest identity/session to correlate steps by in this
-- anonymous flow (see public.guest_sessions' own comment: unused in v1).
-- Concretely, src/lib/data/source.ts's recordGuestReview (the single insert
-- path both call sites below share) is called:
--   1. the moment a guest picks a star, even if they never open the private-
--      feedback form (feedback_text/contact both null) — so the full rating
--      distribution is captured, not just the subset who wrote something in.
--      The existing review_click_google/review_click_tripadvisor rows on
--      public.events already capture the separate "did a public click
--      happen" signal.
--   2. again, as its own additional row, when the guest actually submits the
--      private-feedback form (feedback_text set, contact optional).
--
-- is_test follows the exact same convention as public.events.is_test (see
-- 20260823240000_events_is_test_tag.sql) — set server-side via
-- isNonProductionDeployment() in src/lib/data/source.ts, never derived from
-- parsing any id.
--
-- rating is nullable: the private-feedback option is reachable (and fully
-- clickable, per this table's own header comment above) BEFORE a guest ever
-- picks a star — see GuestReviewScreen.tsx's handleFeedbackSubmit, which
-- passes null rather than 0 in that case. A NOT NULL/1-5 constraint here
-- would silently reject that insert (swallowed by recordGuestReview's
-- fire-and-forget contract) while the guest still sees a success message —
-- i.e. real feedback quietly never saved. Null means "no rating given",
-- never "rating not entered yet" vs "rating deliberately skipped" — this
-- table doesn't distinguish those, and nothing downstream needs it to.
create table public.guest_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  feedback_text text,
  contact text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.guest_reviews is
  'Guest-submitted star rating (PRD §5.6 Review screen), and — for the private-feedback path only — the free-text feedback and an optional contact left alongside it. No SELECT policy is granted to anon or authenticated: this is guest-submitted feedback that may carry PII (contact), and no company-facing read surface has been built for it yet, so only service_role can read it back for now. See recordGuestReview in src/lib/data/source.ts for the single insert path covering both the bare-rating and the private-feedback-with-rating cases.';

comment on column public.guest_reviews.contact is
  'Optional email/phone the guest may leave on the private-feedback form only — never asked for on the bare star-rating path. Free text, unvalidated, same "trust the guest, do not force a shape" posture as feedback_text.';

comment on column public.guest_reviews.is_test is
  'True when this row was recorded from a non-production Vercel deployment (process.env.VERCEL_ENV !== ''production'' — see isNonProductionDeployment in src/lib/data/source.ts). Same convention as public.events.is_test; no read-side rollup exists yet to exclude it from, but the column is here so one can when it does.';

create index guest_reviews_company_id_created_at_idx
  on public.guest_reviews (company_id, created_at desc);

alter table public.guest_reviews enable row level security;

-- Same insert-only shape as "guest_insert_events" in
-- 20260805063611_rls_policies.sql: the guest app is unauthenticated and
-- submits this directly. Deliberately no SELECT policy for anon or
-- authenticated — see this table's own comment above for why reading it
-- back is out of scope for now.
create policy "guest_insert_guest_reviews" on public.guest_reviews
  for insert to anon
  with check (true);
