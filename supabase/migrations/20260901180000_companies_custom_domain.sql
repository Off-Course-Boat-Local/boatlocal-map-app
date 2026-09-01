-- Per-company custom domain: lets a tenant's guest app be reached at their
-- own hostname (e.g. map.offcourseamsterdam.com) with no `?company=` param
-- at all, alongside the existing query-param routing — see
-- src/lib/guestServerContext.ts's header comment for the founder decision
-- this extends ("companies will never get a *subdomain of ours*" was about
-- boatlocal.nl specifically; a company's OWN domain is a different thing
-- and this column is additive, not a replacement for query-param routing).
--
-- Nullable + unique: most companies will never set one; the handful that do
-- must not collide with each other.
alter table public.companies
  add column custom_domain text unique;

comment on column public.companies.custom_domain is
  'Hostname (e.g. map.offcourseamsterdam.com) that resolves straight to this company''s guest app with no ?company= param. Null for tenants using the default boatlocal.nl + query-param routing.';
