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
      testIgnore: [
        /auth\.setup\.ts/,
        /timesheets-.*\.spec\.ts/,
        /invoices-.*\.spec\.ts/,
      ],
      dependencies: ["setup"],
    },
    // The Timesheets journeys write timesheets (removed after each test, with the dates they move) and read the list of
    // all of them, so no two of them may run at the same time, and none may run while the journeys above read the
    // clients' and jobseekers' last-activity dates (the Reports tables): each file is a project that waits for the one
    // before, the first for every other journey.
    {
      name: "timesheets-entry",
      testMatch: /timesheets-entry\.spec\.ts/,
      dependencies: ["setup", "journeys"],
    },
    {
      name: "timesheets-bulk",
      testMatch: /timesheets-bulk\.spec\.ts/,
      dependencies: ["timesheets-entry"],
    },
    {
      name: "timesheets-list-view",
      testMatch: /timesheets-list-view\.spec\.ts/,
      dependencies: ["timesheets-bulk"],
    },
    // The Invoices journeys write invoices (and files in the invoices bucket, removed after each test) and the list reads
    // all of them: like the Timesheets files, each is a project that waits for the one before, the first for the
    // Timesheets journeys (an invoice write moves the clients' and jobseekers' last-activity dates too).
    {
      name: "invoices-create",
      testMatch: /invoices-create\.spec\.ts/,
      dependencies: ["timesheets-list-view"],
    },
    {
      name: "invoices-list-view",
      testMatch: /invoices-list-view\.spec\.ts/,
      dependencies: ["invoices-create"],
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
