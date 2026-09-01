<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database migrations

Apply Supabase migrations via the Supabase CLI (`supabase db push`, or `supabase migration up` for local), never by pasting SQL into the Supabase Dashboard's SQL Editor by hand. If the CLI isn't installed or the project isn't linked yet, install/link it first (`npm install supabase --save-dev` or `npx supabase`, then `supabase link --project-ref hacjzxdyxudcldzwzhbr`) rather than falling back to the dashboard.
