-- Two new categories — founder call, 2026-09-01: "there is no dinner
-- category, also make a wine category". Same reasoning as the "dancing"
-- addition just before this one: "lunch" was standing in for every meal,
-- and drinks/bars aren't the same thing as a dedicated wine spot.
--
-- Two ADD VALUE statements in one file is fine — neither is referenced
-- within this same migration, so Postgres's "unsafe use of new value of
-- enum type in the same transaction it was added" restriction doesn't
-- apply here.
alter type public.category_id add value 'dinner';
alter type public.category_id add value 'wine';
