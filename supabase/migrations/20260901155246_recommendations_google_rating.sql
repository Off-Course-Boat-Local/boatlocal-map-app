-- Reverses a previously deliberate product decision — founder call,
-- 2026-09-01: guests now see Google's rating/review count alongside the
-- guide's own note, where before this app had a hard "no rating anywhere,
-- ever" rule (see the original comment on recommendations.note in
-- 20260805063610_init_schema.sql: "The guide's personal endorsement...
-- This — not a star rating — is the product's entire trust signal.").
-- That comment is now stale; the note is still required and still the
-- primary trust signal, it's just no longer the ONLY signal a guest sees.
--
-- Both columns nullable: only a place added through Google Places
-- enrichment (the "Search Google Maps" button or "Talk to add places")
-- ever has these — a guide typing a place in by hand has no Google rating
-- to attach, and that's fine, the guest UI only renders the badge when
-- both are present.
alter table public.recommendations
  add column google_rating numeric(2, 1) check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  add column google_review_count integer check (google_review_count is null or google_review_count >= 0);

comment on column public.recommendations.google_rating is
  'Google Places rating (0-5, one decimal), captured at add-time from the Places API "Atmosphere Data" tier — never refreshed afterward, so it drifts from Google''s live figure over time exactly like the guide-entered note would. Null for a manually-typed place with no Google source.';
comment on column public.recommendations.google_review_count is
  'Google Places userRatingCount, captured alongside google_rating at the same add-time snapshot. Null under the same conditions as google_rating.';
