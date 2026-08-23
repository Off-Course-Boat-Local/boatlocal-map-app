-- Booking financial/outcome data (real amount_cents, currency, booking_id,
-- confirmed/cancelled status) is admin-only — a company or guide is not
-- meant to see it at all, per the founder's explicit instruction. Every
-- OTHER event type stays visible to a company/guide for their own scope
-- exactly as before (app_open, tip_saved, boat_book_click, review_*,
-- directions_requested, etc.) — this is specifically about booking_outcome.
--
-- company_select_own_events / guide_select_own_events had no event_type
-- filter at all, so a company's or guide's own authenticated session could
-- read full booking_outcome rows for their own scope — via a direct query,
-- or via anything that reads through it, e.g. getCompanyAnalyticsSummary /
-- getGuideAnalyticsSummary in src/lib/data/source.ts, which back Studio's
-- own Dashboard/Report/Guides pages. Fixed here at the RLS layer, the same
-- way 20260822090000_profiles_privileged_columns_guard.sql fixed a similar
-- gap — not by trusting every calling code path to filter it out itself.
--
-- src/lib/data/source.ts's fakeStore branches of those same two functions
-- got a matching by-hand exclusion in the same change: the fake store has no
-- RLS of its own, so without that, the test suite would never actually
-- exercise (or catch a regression of) this restriction.
drop policy "company_select_own_events" on public.events;
create policy "company_select_own_events" on public.events
  for select to authenticated
  using (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and event_type <> 'booking_outcome'
  );

drop policy "guide_select_own_events" on public.events;
create policy "guide_select_own_events" on public.events
  for select to authenticated
  using (
    private.current_role_name() = 'guide'
    and guide_id = private.current_guide_id()
    and event_type <> 'booking_outcome'
  );
