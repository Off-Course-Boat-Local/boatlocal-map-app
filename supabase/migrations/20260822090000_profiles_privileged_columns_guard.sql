-- Make profiles.role / company_id / guide_id immutable to the account itself.
--
-- THE HOLE THIS CLOSES (confirmed exploitable against the live dev project,
-- not theorised): `self_update` in 20260805063611_rls_policies.sql is
--
--     using (id = auth.uid()) with check (id = auth.uid())
--
-- with no guard on WHICH columns a caller may change. `profiles` is exposed
-- through the Data API like every other public table, and every Studio user
-- holds the anon key, so any signed-in company admin or guide could run
--
--     PATCH /rest/v1/profiles?id=eq.<their own uid>
--     {"role":"admin","company_id":null,"guide_id":null}
--
-- from their browser console and become Staff. It satisfies the RLS check
-- (they really are updating their own row) and it satisfies the
-- profile_role_shape CHECK constraint (role='admin' requires exactly those
-- two nulls). private.is_admin() then reads role='admin' back out of this
-- table, so the promotion immediately grants admin_full_access on every
-- table in the schema — every tenant's data, not just their own.
--
-- Verified before writing this migration: demo-company@example.com, signed
-- in normally, successfully set its own role to 'admin'. The row was
-- restored immediately.
--
-- WHY A TRIGGER RATHER THAN TIGHTENING THE POLICY: the natural-looking fix
-- is to add `and role = private.current_role_name()` to self_update's WITH
-- CHECK. That reads correctly but is subtle — those helpers are STABLE and
-- select from `profiles` themselves, so reasoning about what they observe
-- from inside an UPDATE on that same table depends on statement snapshot
-- semantics. A BEFORE UPDATE trigger compares OLD to NEW directly, which
-- needs no such reasoning and cannot be defeated by a policy being added,
-- reordered or relaxed later (Postgres ORs permissive policies together, so
-- one careless new policy re-opens a policy-based fix; it cannot re-open
-- this one).
--
-- WHY THIS BREAKS NOTHING. Checked exhaustively before writing it:
--   * No application code anywhere UPDATEs profiles. Every write in the
--     codebase is an INSERT — guide redemption and company-owner redemption
--     (src/app/join/[token]/actions.ts) and the Staff allowlist bootstrap
--     (src/lib/admin/devAuth.ts) — and this trigger is BEFORE UPDATE only.
--   * No database function writes profiles either (checked pg_proc).
--   * The only pre-existing trigger on the table,
--     profiles_guide_company_matches, is untouched and still runs.
-- So the sole behaviour this changes is the exploit above.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Trusted server-side callers: the service-role client (invite
  -- redemption, and the forthcoming Studio users page changing someone
  -- else's role) and migrations both run without an end-user JWT, so
  -- auth.uid() is null. This is the seam that keeps legitimate role
  -- changes possible while removing self-service ones.
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
  'Blocks a signed-in user changing their own role/company_id/guide_id. Exempts service-role (auth.uid() is null) and Staff. See this migration for the exploit it closes.';

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();
