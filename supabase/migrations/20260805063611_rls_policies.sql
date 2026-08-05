-- Boat Local Map App — row level security
--
-- Enforces (PRD §4 permissions matrix + §14 "no company may see another's
-- data, enforce at the row-security layer"):
--   * admin sees / manages everything.
--   * a company sees only its own guides, recommendations and analytics.
--   * a guide sees their own additions, plus their company's base list
--     read-only; never another company's or another guide's data.
--   * the guest app (unauthenticated, Postgres role `anon`) can read the
--     public, guest-facing content it already renders (brand, guide
--     welcome, visible recommendations, active boat tours, featured
--     toggles) and can only INSERT analytics events — never read another
--     tenant's private management data, because there is no such thing as
--     "own" for anon; it only ever gets the narrow public-read policies
--     below.
--
-- Helper functions live in a `private` schema (not part of Supabase's
-- exposed-schema list, so never reachable via the Data API directly) and
-- are SECURITY DEFINER so policies on `profiles` don't recurse into RLS on
-- `profiles` itself while resolving the caller's own role. Each one takes
-- no arguments and only ever looks at auth.uid() for the *calling* user, per
-- the Supabase security checklist — there is no user-suppliable input, so
-- there is nothing to bypass. See the "supabase" skill's security checklist.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.current_role_name()
returns public.app_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.current_company_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function private.current_guide_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select guide_id from public.profiles where id = auth.uid();
$$;

create or replace function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Takes an explicit p_company_id (unlike the caller-scoped helpers above)
-- because it is used from *guest* policies checking a ROW's parent company,
-- not the calling user's own tenant — anon has no tenant to resolve.
-- Without this, deactivating a company (companies.status <> 'active') would
-- correctly hide the company row itself but leave its guides,
-- recommendations, and featured boat tours still publicly readable, since
-- those tables' own guest_public_read policies only checked their own
-- status/visible flag, never their parent company's.
create or replace function private.company_is_active(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.companies
    where id = p_company_id and status = 'active'
  );
$$;

grant execute on function
  private.current_role_name(), private.current_company_id(),
  private.current_guide_id(), private.is_admin(), private.company_is_active(uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. No table in the public schema ships without it.
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.guides enable row level security;
alter table public.profiles enable row level security;
alter table public.boat_tours enable row level security;
alter table public.company_boat_features enable row level security;
alter table public.recommendations enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.events enable row level security;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.companies
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "company_and_guide_select_own" on public.companies
  for select to authenticated
  using (
    not private.is_admin()
    and id = private.current_company_id()
  );

create policy "company_update_own_branding" on public.companies
  for update to authenticated
  using (private.current_role_name() = 'company' and id = private.current_company_id())
  with check (private.current_role_name() = 'company' and id = private.current_company_id());

-- Guest app: subdomain -> brand resolution, no login (PRD §5.1, §11).
create policy "guest_public_read" on public.companies
  for select to anon
  using (status = 'active');

-- ---------------------------------------------------------------------------
-- guides
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.guides
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "company_manage_own_guides" on public.guides
  for all to authenticated
  using (private.current_role_name() = 'company' and company_id = private.current_company_id())
  with check (private.current_role_name() = 'company' and company_id = private.current_company_id());

create policy "guide_select_self" on public.guides
  for select to authenticated
  using (private.current_role_name() = 'guide' and id = private.current_guide_id());

create policy "guide_update_self" on public.guides
  for update to authenticated
  using (private.current_role_name() = 'guide' and id = private.current_guide_id())
  with check (private.current_role_name() = 'guide' and id = private.current_guide_id());

-- Guest app: guide avatar/name/welcome for the "/slug" in the URL path.
-- Also requires the parent company to be active — a deactivated company's
-- guides must disappear from public view along with it, not just the
-- company's own root page (see private.company_is_active()).
create policy "guest_public_read" on public.guides
  for select to anon
  using (status = 'active' and private.company_is_active(company_id));

-- ---------------------------------------------------------------------------
-- profiles (User/Auth) — never readable by anon.
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.profiles
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "self_select" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- A company can see (not edit) the profile rows tied to its own tenant, to
-- know who has an active Studio login (invited guides, itself).
create policy "company_select_own_tenant_profiles" on public.profiles
  for select to authenticated
  using (private.current_role_name() = 'company' and company_id = private.current_company_id());

-- ---------------------------------------------------------------------------
-- boat_tours — admin-owned catalog (PRD §8.2). Never company/guide-scoped.
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.boat_tours
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Every logged-in company/guide can browse the whole catalog to decide what
-- to feature (PRD §7.5) — it is not tenant data, it's Boat Local's shared
-- inventory.
create policy "authenticated_read_catalog" on public.boat_tours
  for select to authenticated
  using (true);

create policy "guest_public_read" on public.boat_tours
  for select to anon
  using (status = 'active');

-- ---------------------------------------------------------------------------
-- company_boat_features
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.company_boat_features
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "company_manage_own_features" on public.company_boat_features
  for all to authenticated
  using (private.current_role_name() = 'company' and company_id = private.current_company_id())
  with check (private.current_role_name() = 'company' and company_id = private.current_company_id());

-- Guide's Studio view shows featured tours as locked (🔒), read-only (PRD §6.4).
create policy "guide_select_own_company_features" on public.company_boat_features
  for select to authenticated
  using (private.current_role_name() = 'guide' and company_id = private.current_company_id());

create policy "guest_public_read" on public.company_boat_features
  for select to anon
  using (is_featured = true and private.company_is_active(company_id));

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.recommendations
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Company: sees every recommendation under its own tenant (base list +
-- every guide's personal items) for dashboards/reporting (PRD §7.1, §7.7),
-- but may only create/edit/delete the base-list rows it owns
-- (owner_type='company') — a guide's personal item is the guide's to edit,
-- per the permissions matrix in PRD §4.
create policy "company_select_own_tenant" on public.recommendations
  for select to authenticated
  using (private.current_role_name() = 'company' and company_id = private.current_company_id());

create policy "company_manage_base_list" on public.recommendations
  for insert to authenticated
  with check (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and owner_type = 'company'
  );

create policy "company_update_base_list" on public.recommendations
  for update to authenticated
  using (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and owner_type = 'company'
  )
  with check (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and owner_type = 'company'
  );

create policy "company_delete_base_list" on public.recommendations
  for delete to authenticated
  using (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and owner_type = 'company'
  );

-- Guide: reads the base list (read-only, inherited) plus their own items;
-- may only write their own items. This is the "guide sees own additions
-- plus their company's base list, read-only" requirement.
create policy "guide_select_base_and_own" on public.recommendations
  for select to authenticated
  using (
    private.current_role_name() = 'guide'
    and company_id = private.current_company_id()
    and (owner_type = 'company' or guide_id = private.current_guide_id())
  );

create policy "guide_manage_own_items" on public.recommendations
  for insert to authenticated
  with check (
    private.current_role_name() = 'guide'
    and company_id = private.current_company_id()
    and owner_type = 'guide'
    and guide_id = private.current_guide_id()
  );

create policy "guide_update_own_items" on public.recommendations
  for update to authenticated
  using (
    private.current_role_name() = 'guide'
    and company_id = private.current_company_id()
    and owner_type = 'guide'
    and guide_id = private.current_guide_id()
  )
  with check (
    private.current_role_name() = 'guide'
    and company_id = private.current_company_id()
    and owner_type = 'guide'
    and guide_id = private.current_guide_id()
  );

create policy "guide_delete_own_items" on public.recommendations
  for delete to authenticated
  using (
    private.current_role_name() = 'guide'
    and company_id = private.current_company_id()
    and owner_type = 'guide'
    and guide_id = private.current_guide_id()
  );

-- Guest app: this *is* the map/list content. Public by product design.
create policy "guest_public_read" on public.recommendations
  for select to anon
  using (visible = true and private.company_is_active(company_id));

-- ---------------------------------------------------------------------------
-- guest_sessions — no client policy yet (see table comment). Admin only,
-- for whenever cross-device sync analytics land.
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.guest_sessions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy "admin_full_access" on public.events
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "company_select_own_events" on public.events
  for select to authenticated
  using (private.current_role_name() = 'company' and company_id = private.current_company_id());

create policy "guide_select_own_events" on public.events
  for select to authenticated
  using (private.current_role_name() = 'guide' and guide_id = private.current_guide_id());

-- The guest app is unauthenticated and fires analytics events directly
-- (PRD §10). Insert-only — anon can never read events back.
create policy "guest_insert_events" on public.events
  for insert to anon
  with check (true);

create policy "authenticated_insert_events" on public.events
  for insert to authenticated
  with check (true);
