-- CLOSES A HOLE FOUND WHILE WRITING THE INTEGRATION TEST FOR
-- 20260823160000_admin_password_set.sql
-- (src/lib/admin/passwordSet.integration.test.ts), CONFIRMED AGAINST THE
-- REAL DEV PROJECT, NOT JUST THEORISED.
--
-- 20260823160000 folded password_set into profiles_guard_privileged_
-- columns's existing "if private.is_admin() then return new" exemption,
-- per the instruction that it join role/company_id/guide_id's "same
-- category". For those three columns that exemption is correct and
-- pre-existing: Staff legitimately reassigns another user's role from an
-- admin UI, and an admin editing its own row there is a harmless no-op
-- (it's already role='admin', company_id/guide_id null).
--
-- password_set is not a no-op under that same exemption. private.is_admin()
-- only checks role='admin' — completely independent of whether this row has
-- ever actually called supabase.auth.updateUser({password}) — so exempting
-- it the same way let exactly the account the forced /admin/set-password
-- flow exists to gate mark itself "password set" via a bare
--   PATCH /rest/v1/profiles?id=eq.<their own uid> {"password_set":true}
-- from a browser console, without ever setting a real password.
-- src/lib/admin/passwordSet.integration.test.ts's "rejects the admin
-- flipping its own password_set" case caught this: under 20260823160000's
-- version of the function, that update succeeded when it should have been
-- rejected.
--
-- Not a privilege-escalation hole — the account is already admin either
-- way — but a real self-lockout one: once password_set reads true,
-- /admin/login stops sending magic links to that address (see
-- src/lib/admin/loginMethod.ts) and instead shows a password field, for a
-- password that was never actually set — stranding that admin with no
-- working sign-in method at all.
--
-- Fix: check password_set unconditionally, ahead of the Staff exemption,
-- and never exempt it — not even for Staff. There is no legitimate reason
-- for ANY authenticated session to flip its own or anyone else's
-- password_set: the one real write path
-- (src/app/admin/set-password/actions.ts) already goes through the
-- service-role client, i.e. auth.uid() is null, which this change does not
-- touch.

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
  -- so auth.uid() is null.
  if auth.uid() is null then
    return new;
  end if;

  -- Checked ahead of, and independently of, the Staff exemption below —
  -- unlike role/company_id/guide_id, password_set has no legitimate
  -- self-service OR admin-UI write path at all. See this migration's
  -- header for the concrete hole this closes.
  if new.password_set is distinct from old.password_set then
    raise exception using
      errcode = '42501',
      message = 'profiles.password_set is not self-editable, not even by Staff',
      detail = format(
        'profile %s attempted password_set %s -> %s',
        old.id, old.password_set, new.password_set
      ),
      hint = 'Only the service-role client may set this (src/app/admin/set-password/actions.ts), immediately after supabase.auth.updateUser({ password }) succeeds for that same signed-in user.';
  end if;

  -- Staff acting through their own session, via admin_full_access — the
  -- remaining, pre-existing exemption, for role/company_id/guide_id only.
  if private.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.guide_id is distinct from old.guide_id
  then
    raise exception using
      errcode = '42501',
      message = 'profiles.role, company_id and guide_id are not self-editable',
      detail = format(
        'profile %s attempted role %s -> %s, company_id %s -> %s, guide_id %s -> %s',
        old.id, old.role, new.role,
        old.company_id, new.company_id,
        old.guide_id, new.guide_id
      ),
      hint = 'These are set by invite redemption or by Staff, never by the account itself.';
  end if;

  return new;
end;
$$;

comment on function public.profiles_guard_privileged_columns() is
  'Blocks a signed-in user changing their own role/company_id/guide_id (Staff exempted) or password_set (nobody with a real session exempted, not even Staff). See 20260822090000 and 20260823160000 for the earlier history, and this migration for why password_set could not simply join the same Staff exemption.';
