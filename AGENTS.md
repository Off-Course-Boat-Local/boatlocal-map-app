<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database migrations

Apply Supabase migrations via the Supabase CLI (`supabase db push`, or `supabase migration up` for local), never by pasting SQL into the Supabase Dashboard's SQL Editor by hand. If the CLI isn't installed or the project isn't linked yet, install/link it first (`npm install supabase --save-dev` or `npx supabase`, then `supabase link --project-ref hacjzxdyxudcldzwzhbr`) rather than falling back to the dashboard.

# SEO / indexing — hard rule

`map.boatlocal.nl` is the guest/studio app, never an SEO surface. The whole
site must always stay noindex:

- The root `src/app/layout.tsx` sets `metadata.robots = { index: false, follow: false }`. Do not remove it, and do not give any page its own `metadata.robots` that turns indexing back on.
- `src/app/robots.ts` disallows the whole site for every crawler.

Boatlocal.nl's own SEO pages live in the `boatlocal` repo, not here. If a page
on this app ever needs to be public and indexed, that is a decision for Beer
first, not a default.
