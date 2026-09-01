-- recommendations.category (single, required category_id) -> categories
-- (category_id[], at least one) — founder request 2026-09-01: a place can
-- genuinely be more than one thing ("cafe" AND "breakfast spot"), and the
-- old single-select forced an admin/guide to pick just one.
--
-- Kept as an array on the SAME table rather than a join table: there's no
-- need to query "all recommendations of category X" with anything fancier
-- than `categories && array['X']` (see the GIN index below), and every
-- reader of this column already goes through fromRecommendationRow /
-- guest_map_pins — no ad-hoc SQL elsewhere depends on the old shape.
--
-- 'boats' stays permanently excluded, same reasoning as the original
-- recommendation_category_not_boats check (boat tours are a separate table,
-- never a recommendation row) — the old CHECK just needs to become an
-- array-aware one.
--
-- Primary category for pin colour/icon (see src/lib/categories.ts's "one
-- pin = one colour, at a glance" design note): the app always reads
-- categories[1] as primary — see MapPins.tsx and guest_map_pins' comment in
-- the companion migration. No separate "primary" column: array order IS the
-- priority order, set by the form the row was created/edited through.

alter table public.recommendations
  add column categories public.category_id[];

update public.recommendations
  set categories = array[category];

alter table public.recommendations
  alter column categories set not null;

alter table public.recommendations
  drop constraint recommendation_category_not_boats;

alter table public.recommendations
  drop column category;

alter table public.recommendations
  add constraint recommendation_categories_not_empty check (array_length(categories, 1) > 0);

alter table public.recommendations
  add constraint recommendation_categories_not_boats
    check (not (categories && array['boats']::public.category_id[]));

drop index if exists public.recommendations_category_idx;

-- GIN, not btree: queries against this column are containment/overlap
-- (`categories && array[...]`), which btree can't accelerate at all.
create index recommendations_categories_idx on public.recommendations using gin (categories);
