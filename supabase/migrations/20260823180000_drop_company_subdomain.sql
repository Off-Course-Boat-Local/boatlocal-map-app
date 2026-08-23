-- The founder's decision: companies stop having an admin-typed "subdomain"
-- field at all. The wildcard-subdomain routing this column existed for
-- (PRD §13.1, `{company}.map.boatlocal.nl`) was never wired to real DNS or
-- hosting, and the founder does not intend to use this field for subdomains
-- later ("I don't think these companies would be applying subdomains...
-- That field should just be an ID, as we're not going to be using it as
-- subdomains later"). Every real guest link already resolves a tenant via
-- `?company=<uuid>&guide=<slug>` (see src/lib/guestBrand.ts), keyed on the
-- company's own primary key — so this column has no remaining purpose.
--
-- company_by_subdomain (20260805063612_helper_functions.sql) is the only
-- other database object whose body referenced `subdomain` by name — it is
-- dropped here too, since its one caller (src/lib/data/source.ts's
-- getCompanyBrand) now looks a company up by id directly instead of via
-- this RPC. Grepping every migration for "subdomain" turned up nothing else
-- executable: no RLS policy filters on it (guest_public_read already gates
-- on `status = 'active'` alone) and no index other than the column's own
-- `unique` constraint names it, which `drop column` removes along with it.
drop function if exists public.company_by_subdomain(text);

alter table public.companies
  drop column subdomain;
