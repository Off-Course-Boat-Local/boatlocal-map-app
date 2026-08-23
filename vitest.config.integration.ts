// Real-Supabase integration test config — SEPARATE from vitest.config.ts on
// purpose. `npm test` (vitest.config.ts) must stay fast and network-free
// against src/lib/data/fakeStore.ts; this config is for
// `npm run test:integration` only, which hits the real Supabase project
// credentials in .env.local.
//
// Two things this config exists specifically to handle:
//
// 1. `src/lib/data/source.ts` decides fakeStore-vs-real-Supabase with
//    `const isTestEnv = process.env.VITEST === "true"` (see that file's own
//    header comment). Vitest itself sets `process.env.VITEST = "true"`
//    before any test file or setupFile runs, for *every* config, including
//    this one — there is no built-in way to run a test *file* through the
//    `vitest` binary without that flag being set. `src/test/integration-env.ts`
//    (this config's setupFiles entry) flips it back to `"false"` as its
//    first statement, which — because setupFiles are imported and fully
//    evaluated before the test file that follows them ever starts importing
//    anything — is early enough that `source.ts`'s top-level
//    `const isTestEnv = ...` line reads `"false"` the first time source.ts
//    is loaded in this worker. Verified empirically (see this file's sibling
//    test `src/lib/data/source.realpath.integration.test.ts`, which asserts
//    against a row that provably exists only in the real database, never in
//    fakeStore, and would come back null if this flip had not taken effect).
// 2. Sequential execution: `fileParallelism: false` runs every integration
//    test file one after another, never in parallel — required because
//    these tests share one real Postgres database and create/delete real
//    rows (companies, guides, profiles, auth users). Parallel workers here
//    would race on cleanup and produce flaky FK/unique-constraint failures
//    against the live project. (Vitest 4 moved this out of the old
//    `poolOptions.forks.singleFork` shape — see the v4 migration guide.)
//
// Env vars themselves come from `.env.local` via Node's own `--env-file`
// flag (see the "test:integration" script in package.json) — not from this
// config — so nothing here ever touches or duplicates real credentials.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The `server-only` package (imported by src/lib/supabase/admin.ts,
      // reached for real by adminClient()) has no runtime check at all —
      // its default export is an unconditional `throw new Error(...)`,
      // resolved away to a no-op (its own `empty.js`) only when a bundler
      // picks its package.json's `"react-server"` conditional export
      // instead. Next.js's webpack config does that automatically; plain
      // Vitest does not. Setting that condition globally (tried first) is
      // NOT the fix — it also flips React's own resolution to its
      // react-server build, which is missing ordinary APIs like
      // createContext and broke unrelated client-side imports transitively
      // pulled in elsewhere. A direct alias to server-only's own empty.js
      // is the narrow fix: it only ever affects this one marker package.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/test/integration-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
