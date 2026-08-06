import path from "node:path";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Real-Supabase integration tests (vitest.config.integration.ts, run via
    // `npm run test:integration`) live in *.integration.test.ts files and
    // must NEVER be picked up here — this suite has to stay fast and
    // network-free. Without this exclude, the include glob above matches
    // them too (an integration test file's name still ends in `.test.ts`),
    // and `npm test` would try to run them without .env.local loaded and
    // without network access, failing loudly for reasons unrelated to the
    // fake-store suite itself.
    exclude: [...defaultExclude, "src/**/*.integration.test.ts"],
  },
});
