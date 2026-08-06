// Setup file for vitest.config.integration.ts ONLY — never referenced by
// vitest.config.ts / `npm test`. See vitest.config.integration.ts's header
// comment for the full explanation of why this exists.
//
// Vitest sets `process.env.VITEST = "true"` before running any test file in
// ANY config, including this integration one. src/lib/data/source.ts uses
// exactly that flag to decide whether to hit its in-memory fakeStore or the
// real Supabase project. Flipping it back here — as this setup file's first
// and only job — makes source.ts take its real-Supabase branch for every
// integration test, because setupFiles finish importing (and this line runs)
// before the test files that import source.ts start loading.
//
// This does NOT affect `npm test`: that command uses vitest.config.ts, whose
// setupFiles array is `["./src/test/setup.ts"]` and does not include this
// file, so the fake-store suite keeps seeing VITEST="true" exactly as before.
process.env.VITEST = "false";

// Fail loudly and immediately if someone runs `npm run test:integration`
// without real credentials configured, rather than letting every individual
// test file fail with a confusing "Check .env.local" error one at a time.
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Integration tests require real Supabase credentials, missing: ${missing.join(", ")}. ` +
      "Run via `npm run test:integration`, which loads .env.local with Node's --env-file flag.",
  );
}
