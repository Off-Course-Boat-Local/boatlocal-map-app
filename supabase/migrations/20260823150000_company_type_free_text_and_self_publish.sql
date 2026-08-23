-- Two changes from revisiting the company-onboarding structure with the
-- founder:
--
-- 1. `company_type` stops being a fixed enum (hotel/tour/host) and becomes
--    free, optional text ("Hotel", "Shop", "Bar", whatever the operator
--    types) — it has never driven any behaviour in the app, only ever been
--    displayed, so a closed vocabulary was pure friction with no payoff.
--
-- 2. A company can now flip its OWN status between 'setup' and 'active' —
--    the self-service "publish / unpublish" toggle Studio needs so an
--    owner controls when their tenant goes guest-visible, instead of Admin
--    picking an initial status at onboarding time. 'suspended' stays
--    admin-only in both directions (private.is_admin()) — that one is a
--    punitive action, not something a company should be able to undo on
--    itself.
--
-- guest_public_read (status = 'active') and getActiveCompanyRecord already
-- gate every guide under a company on the company's own status, so
-- unpublishing a company already takes every one of its guides' guest
-- links down with it — no separate guide-side change needed for that part.

alter table public.companies
  alter column company_type drop default,
  alter column company_type type text using company_type::text,
  alter column company_type drop not null;

drop type public.company_type;

drop policy "company_update_own_branding" on public.companies;

create policy "company_update_own_branding" on public.companies
  for update to authenticated
  using (
    private.current_role_name() = 'company'
    and id = private.current_company_id()
    -- A suspended company can't touch its own row at all (not branding,
    -- not status) — reactivating out of 'suspended' is admin-only, via the
    -- separate admin_full_access policy (`for all ... using
    -- (private.is_admin())`), not this one.
    and status <> 'suspended'
  )
  with check (
    private.current_role_name() = 'company'
    and id = private.current_company_id()
    -- A company may only ever set itself to 'setup' or 'active' — it can
    -- never assign itself 'suspended' either.
    and status in ('setup', 'active')
  );
