-- Platform-default company (founder's decision): a guest who lands on the
-- bare root URL with no `?company=<uuid>` at all needs to see something
-- real, not src/lib/brand.ts's hardcoded prototype-era BRANDS.coastal
-- ("Jan's Amsterdam") — that object was always meant as a preview swatch,
-- never as production fallback content for a real, no-tenant visit.
--
-- The fix is a real row in `companies`, managed through the exact same
-- Studio-style tools (branding + recommendations) every other tenant is,
-- just flagged as the one shown when no company is specified. This is a
-- plain server-side lookup key, not a guest-readable attribute in its own
-- right — guest_public_read's existing `status = 'active'` filter already
-- governs whether the flagged row's own data is visible, exactly like any
-- other company. Deliberately no RLS policy change: nothing here grants any
-- new read/write surface, it only adds a column an admin-only code path
-- (src/lib/data/source.ts's setPlatformDefaultCompany) writes to, already
-- covered by the existing admin_full_access policy.
alter table public.companies
  add column is_platform_default boolean not null default false;

-- "At most one company can be the platform default" — a partial unique
-- index on the boolean is the standard Postgres pattern for this: every
-- `false` row is excluded from the index entirely (so there is no limit on
-- how many companies have the flag off), while at most one `true` row can
-- ever exist. Cheaper and simpler than a trigger, and self-enforcing even
-- against a bug in setPlatformDefaultCompany that forgets to clear the
-- previous holder first.
create unique index companies_one_platform_default
  on public.companies (is_platform_default)
  where is_platform_default;
