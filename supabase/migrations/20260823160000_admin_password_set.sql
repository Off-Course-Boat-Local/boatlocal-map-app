-- Admin password sign-in: profiles.password_set.
--
-- Admin has only ever had magic-link sign-in (src/lib/admin/devAuth.ts).
-- Adding real password auth on top of it needs one thing this app doesn't
-- otherwise track: whether a given admin has ever actually set a password,
-- so /admin/login knows whether to send a magic link (first time / never
-- set one) or reveal a password field (already has one).
--
-- There is no trustworthy client-safe way to ask Supabase "does this
-- auth.users row have a password set" without the service-role Admin API,
-- and even that isn't a clean boolean check — so this is a new app-owned
-- column instead, flipped server-side (src/app/admin/set-password/actions.ts)
-- immediately after a successful `supabase.auth.updateUser({ password })`,
-- via the service-role admin client (src/lib/supabase/admin.ts) — never
-- settable directly by the account's own session.
--
-- That last part is enforced here, not just by convention: password_set
-- joins role/company_id/guide_id in the privileged-columns guard trigger
-- from 20260822090000_profiles_privileged_columns_guard.sql. Same category,
-- same reasoning — `self_update`'s RLS policy
-- (using (id = auth.uid()) with check (id = auth.uid())) has no per-column
-- guard, so without this a signed-in admin could
-- `PATCH /rest/v1/profiles?id=eq.<their own uid> {"password_set":true}`
-- from a browser console and mark themselves as having set a password
-- without ever calling updateUser() — defeating the forced
-- /admin/set-password flow for their own row. The trigger function is
-- `create or replace`d in place (same function, same trigger already
-- attached to the table) rather than adding a second trigger, so there is
-- exactly one place that reasons about "which profiles columns are
-- self-editable".
--
-- Defaults to false for every existing and future row, including
-- company/guide profiles — Studio has no password auth, so those rows just
-- never move off the default.

alter table public.profiles
  add column password_set boolean not null default false;

comment on column public.profiles.password_set is
  'True once this admin has completed supabase.auth.updateUser({ password }) '
  'via the forced /admin/set-password flow. App-owned source of truth (no '
  'client-safe way to read this off auth.users directly). Flipped '
  'server-side via the service-role client only — see the '
  'profiles_guard_privileged_columns trigger, which blocks a self-update of '
  'this column the same way it blocks role/company_id/guide_id. Only ever '
  'meaningful for role=''admin'' rows; company/guide profiles stay at the '
  'default false since Studio sign-in is magic-link only.';

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Trusted server-side callers: the service-role client (invite
  -- redemption, admin password setup, and the Studio users page changing
  -- someone else's role) and migrations both run without an end-user JWT,
  -- so auth.uid() is null. This is the seam that keeps legitimate changes
  -- possible while removing self-service ones.
  if auth.uid() is null then
    return new;
  end if;

  -- Staff acting through their own session, via admin_full_access.
  if private.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.guide_id is distinct from old.guide_id
     or new.password_set is distinct from old.password_set
  then
    raise exception using
      errcode = '42501',
      message = 'profiles.role, company_id, guide_id and password_set are not self-editable',
      detail = format(
        'profile %s attempted role %s -> %s, company_id %s -> %s, guide_id %s -> %s, password_set %s -> %s',
        old.id, old.role, new.role,
        old.company_id, new.company_id,
        old.guide_id, new.guide_id,
        old.password_set, new.password_set
      ),
      hint = 'These are set by invite redemption, the admin password-setup flow, or by Staff, never by the account itself.';
  end if;

  return new;
end;
$$;

comment on function public.profiles_guard_privileged_columns() is
  'Blocks a signed-in user changing their own role/company_id/guide_id/password_set. Exempts service-role (auth.uid() is null) and Staff. See 20260822090000 for the exploit this originally closed, and 20260823160000 for why password_set joined the guarded set.';
