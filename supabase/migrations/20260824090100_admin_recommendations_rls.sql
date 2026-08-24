-- Admin-curated recommendations, scoped to one company — step 2 of 2 (see
-- 20260824090000_recommendation_owner_type_add_admin.sql for why the enum
-- value had to land in its own prior, already-committed migration first).
--
-- THE FEATURE: Boat Local staff can plant a recommendation into one specific
-- company's guest map/list — owner_type = 'admin', guide_id = null, same
-- `recommendations` table as every other row — that:
--   * IS shown to that company's guests, indistinguishable from any other
--     recommendation (no special guest-side treatment at all);
--   * is NEVER visible, and NEVER editable/deletable, from that company's
--     own Studio dashboard — a company must not know these rows exist, let
--     alone touch them. This is a real security/product boundary, not a UI
--     nicety: it has to hold even if a company's Studio session queries the
--     `recommendations` table directly (not just through the app's own
--     fetch calls), which is exactly what RLS is for.
--
-- SECURITY MODEL — walking every policy on this table (see
-- 20260805063611_rls_policies.sql's "recommendations" section) and stating,
-- for each, whether it had to change and why:
--
--   * admin_full_access (for all, private.is_admin()) — already grants an
--     admin session full CRUD on every owner_type, including the new
--     'admin' one. NOT CHANGED.
--
--   * company_select_own_tenant (for select) — THE ONE POLICY THAT MUST
--     CHANGE. Its `using` clause was only `company_id =
--     private.current_company_id()`, with NO owner_type filter at all, so a
--     company's own authenticated session could SELECT every row under its
--     tenant regardless of owner_type — including an 'admin'-owned one, the
--     exact thing this feature must prevent. Fixed below by dropping and
--     recreating it with `and owner_type <> 'admin'` added (Postgres has no
--     `alter policy ... using (...)`, only `alter policy ... rename to`, so
--     drop + create is the only way to change a policy's condition).
--
--   * company_manage_base_list / company_update_base_list /
--     company_delete_base_list (insert/update/delete) — each already
--     hard-requires `owner_type = 'company'` in its with-check/using clause.
--     A company's session literally cannot satisfy that clause for a row
--     whose owner_type is 'admin' — there is no write path through these
--     policies onto an admin-owned row. NOT CHANGED.
--
--   * guide_select_base_and_own (for select) — its `using` clause is
--     `owner_type = 'company' or guide_id = private.current_guide_id()`.
--     For an admin-owned row, guide_id is null (enforced by the CHECK
--     constraint below), and in SQL `null = <a guide's own non-null uuid>`
--     evaluates to NULL, not true — neither branch of the `or` is satisfied,
--     so this condition already never matches an admin-owned row. NOT
--     CHANGED. (Verified against a real Postgres instance, not just on
--     paper, by src/lib/data/source.integration.test.ts's
--     "guide actor never sees an admin-owned row via RLS" case.)
--
--   * guide_manage_own_items / guide_update_own_items /
--     guide_delete_own_items — each already hard-requires `owner_type =
--     'guide'`, same reasoning as the company write policies above. NOT
--     CHANGED.
--
--   * guest_public_read (for select, to anon) — `visible = true and
--     private.company_is_active(company_id)`, no owner_type filter. This
--     ALREADY includes an admin-owned row the moment one exists, which is
--     exactly the wanted behaviour (a guest sees it exactly like any other
--     recommendation, no special-casing). NOT CHANGED.
--
-- CHECK CONSTRAINT: recommendation_owner_shape only allowed
-- (owner_type='company' and guide_id is null) or (owner_type='guide' and
-- guide_id is not null) — an insert with owner_type='admin' would be
-- rejected at the table level even if every RLS policy allowed it. Widened
-- below to also allow (owner_type='admin' and guide_id is null), mirroring
-- the 'company' shape exactly (an admin-owned row is never guide-scoped).

alter table public.recommendations
  drop constraint recommendation_owner_shape;

alter table public.recommendations
  add constraint recommendation_owner_shape check (
    (owner_type = 'company' and guide_id is null)
    or (owner_type = 'guide' and guide_id is not null)
    or (owner_type = 'admin' and guide_id is null)
  );

drop policy "company_select_own_tenant" on public.recommendations;
create policy "company_select_own_tenant" on public.recommendations
  for select to authenticated
  using (
    private.current_role_name() = 'company'
    and company_id = private.current_company_id()
    and owner_type <> 'admin'
  );
