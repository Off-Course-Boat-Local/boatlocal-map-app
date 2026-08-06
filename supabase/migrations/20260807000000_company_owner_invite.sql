-- Company owner invite — mirrors guides.status/invite_token exactly
-- (20260805063610_init_schema.sql), for the same reason: createCompany()
-- used to only ever insert a `companies` row, with no path for anyone at
-- that company to actually sign in and manage it. A guide's invite always
-- had a designed path from "row exists" to "a real person can sign in as
-- that row" — a company never did. This closes that gap the same way.
--
-- Deliberately three separate nullable columns, not a rework of the
-- existing `status` column: `status` (setup/active/suspended) is about
-- guest-visibility — whether guests can see this tenant at all — a
-- completely different axis from whether the company's own Studio user
-- has claimed their account. A company can be status='setup' with a
-- claimed owner, or (Admin's own choice) status='active' with an
-- unclaimed one — the two must vary independently.
--
-- All three are nullable, with NULL meaning "no owner invite has ever been
-- issued for this company" — every row created before this migration
-- (today: the one seeded tenant) has no owner account and none of this
-- retroactively assumes one exists.

alter table public.companies
  add column owner_email text,
  add column owner_status text check (owner_status in ('invited', 'active')),
  add column owner_invite_token text;

comment on column public.companies.owner_email is
  'The company''s first Studio user (role=company), collected at Admin onboarding time (createCompany, PRD §8.3). Null for rows created before this existed, or if onboarding is ever completed without one.';

comment on column public.companies.owner_status is
  '''invited'' from creation until redeemed at /join/[token] (mirrors guides.status); ''active'' once claimed. Null means no owner invite has ever been issued for this company — distinct from ''invited'', not a third state guarded by the check constraint on purpose: a NULL here should never be treated as "pending," only "not applicable."';

comment on column public.companies.owner_invite_token is
  'Set at invite time, cleared once redeemed — same pattern as guides.invite_token. Never exposed through the general-purpose CompanyRecord type (src/lib/data/types.ts) or any anon-readable query; only read directly by the admin-client lookup in src/app/join/[token] — see that flow''s own comments for why leaking this value would let anyone claim the company''s owner account.';

-- Existing RLS policies on `companies` (guest_public_read, admin_full_access,
-- company_update_own_branding — 20260805063611_rls_policies.sql) already
-- cover these new columns: Postgres RLS is row-level, not column-level, so
-- no new policy is needed for "who can see this row" to keep applying here.
-- What IS new is that a company could now be status='active' (guest-visible)
-- while owner_status='invited' with a live, unredeemed token — Admin's own
-- onboarding form allows setting initial status to 'active' independently
-- of whether an owner has claimed the account yet, and that is a real,
-- intentional choice this migration does not second-guess. The token
-- staying safe in that case is NOT enforced by RLS; it is enforced by
-- application code never selecting owner_invite_token through any
-- anon-reachable path (fromCompanyRow in src/lib/data/source.ts maps
-- owner_email/owner_status only, never owner_invite_token) — see that
-- file's own comments at the call site.
