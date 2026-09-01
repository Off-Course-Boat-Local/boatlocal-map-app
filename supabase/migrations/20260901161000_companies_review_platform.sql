-- Which ONE of the company's two review links (google/tripadvisor) the
-- guest Review screen actually shows and redirects to — never both at once
-- (founder call, 2026-09-01). Defaults every existing row to "google",
-- matching getReviewOptions' own default in src/lib/guestReview.ts.
alter table companies
  add column review_platform text not null default 'google'
    check (review_platform in ('google', 'tripadvisor'));
