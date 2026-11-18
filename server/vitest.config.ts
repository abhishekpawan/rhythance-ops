import { defineConfig } from "vitest/config";

// The machine's timezone must not matter: the portal's dates are Toronto dates. Run the tests in a
// zone far from Toronto (UTC+14) so a function that quietly depends on the local zone fails here.
process.env.TZ = process.env.TEST_TZ ?? "Pacific/Kiritimati";

export default defineConfig({
  test: {
    // the integration files share one database and one server, and some change accounts: one file at a time
    fileParallelism: false,
    projects: [
      {
        // Needs nothing running: the guard's own tests and the unit tests of the money and date functions.
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/guard/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        // The real server against a fresh local Supabase built from migration_v2 and the synthetic seed.
        test: {
          name: "integration",
          include: [
            "tests/access/**/*.test.ts",
            "tests/schema/**/*.test.ts",
            "tests/pins/**/*.test.ts",
          ],
          globalSetup: ["tests/support/global-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 900_000,
        },
      },
    ],
  },
});
