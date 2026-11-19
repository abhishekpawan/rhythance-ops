import { defineConfig } from "@playwright/test";

// Browser journeys (Chromium only) against the client and server that support/global-setup.ts starts on
// this machine. No fixed sleeps anywhere: every wait is for something the page shows or sends.
export default defineConfig({
  testDir: "tests",
  globalSetup: "./support/global-setup.ts",
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  // staff sign-in sends one (recorded, never delivered) code per login; the journeys share one database
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  projects: [
    // signs in the accounts the Reports journeys use, once, and saves their browser state in .auth/
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "journeys",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
    },
  ],
  // a missing snapshot is a failure on CI, never a silent write
  updateSnapshots: process.env.CI ? "none" : "missing",
  use: {
    browserName: "chromium",
    locale: "en-CA",
    timezoneId: "America/Toronto",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
