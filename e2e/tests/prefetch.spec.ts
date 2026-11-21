// After sign-in, once the first page is on screen and the browser is idle, the app fetches the code of the other
// pages the person can open, one page at a time (client/src/routes/prefetchPages.ts), so moving between pages does
// not wait for a download. Runs on the production build only (each page is a file of its own there):
// `E2E_CLIENT=build pnpm test:e2e`. The dev server compiles pages when they are asked for and does not prefetch.
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { PASSWORD, jobseekers } from "../support/accounts";
import { expect, test } from "../support/fixtures";

test.skip(
  process.env.E2E_CLIENT !== "build",
  "needs the production build (E2E_CLIENT=build)"
);

const SLOW = 90_000;

/** The script files (assets/<Name>-<hash>.js) the browser downloads from now on, with their gzip size over the wire. */
function watchFiles(page: Page) {
  const sizes = new Map<string, number>(); // file name -> gzip bytes
  page.on("response", (response) => {
    const file = new URL(response.url()).pathname.match(
      /^\/assets\/([\w-]+\.js)$/
    )?.[1];
    if (!file) return;
    void response.body().then(
      (body) => sizes.set(file, gzipSync(body).length),
      () => undefined
    );
  });
  return {
    /** Was a file of this page (or chunk) downloaded? */
    has: (name: string) =>
      [...sizes.keys()].some((f) => f.startsWith(`${name}-`)),
    count: () => sizes.size,
    files: () => new Set(sizes.keys()),
    bytes: (only?: Set<string>) =>
      [...sizes]
        .filter(([file]) => !only || only.has(file))
        .reduce((sum, [, n]) => sum + n, 0),
  };
}

test.describe("an administrator", () => {
  test.use({ storageState: ".auth/admin.json" });

  test("gets the other pages' files in the background, and nothing only a super administrator opens", async ({
    page,
  }) => {
    test.setTimeout(SLOW + 30_000);
    const files = watchFiles(page);
    await page.goto("/dashboard");
    await page.locator(".dashboard-heading").waitFor();
    // not waiting for the network to be quiet: the background download keeps it busy until it is done
    const onDashboard = files.files(); // roughly what showing the dashboard needed

    // the last page of the list for this role: when it is there, every page before it was fetched
    await expect
      .poll(() => files.has("SupportTicket"), { timeout: SLOW })
      .toBe(true);
    for (const name of [
      "CalendarPage",
      "ClientManagement",
      "PositionMatching",
      "InvoiceList",
      "Reports",
      "SalesReport",
      "SupportList",
      "ConsentListPage",
    ])
      expect(files.has(name), name).toBe(true);
    for (const name of [
      "Signup", // sign-up pages: nobody is signed in there
      "FeatureFlagsPage", // super administrators only
      "PortalSettingsPage",
      "JobSeekerPositions", // jobseekers only
    ])
      expect(files.has(name), name).toBe(false);

    const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
    console.log(
      `PREFETCH admin: ${kb(files.bytes(onDashboard))} gzip to show the dashboard, then ${
        files.count() - onDashboard.size
      } more files, ${kb(files.bytes() - files.bytes(onDashboard))} gzip`
    );
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      "test-results/prefetch-admin.json",
      JSON.stringify({
        files: [...files.files()],
        onDashboard: [...onDashboard],
      })
    );
  });

  test("a file that cannot be downloaded in the background is ignored: no reload, the rest is not fetched", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    let refused = 0;
    await page.route(/\/assets\/Reports-[\w-]+\.js$/, (route) => {
      refused++;
      return route.fulfill({ status: 404, body: "Not Found" });
    });
    let loads = 0;
    page.on("load", () => loads++);
    const files = watchFiles(page);
    await page.goto("/dashboard");
    await page.locator(".dashboard-heading").waitFor();
    await expect.poll(() => refused, { timeout: SLOW }).toBe(1);
    // that something does NOT happen needs a wait: give a reload, and the pages after the failed one, every chance
    await page.waitForTimeout(4000);
    expect(loads).toBe(1);
    expect(refused).toBe(1);
    expect(files.has("SupportTicket")).toBe(false);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("reloaded-for-missing-chunk")
      )
    ).toBeNull();
    await expect(page.locator(".dashboard-heading")).toBeVisible();
  });

  test("nothing is fetched ahead when the browser asks to save data", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: true },
      });
    });
    const files = watchFiles(page);
    await page.goto("/dashboard");
    await page.locator(".dashboard-heading").waitFor();
    await page.waitForLoadState("networkidle");
    const known = files.count();
    await page.waitForTimeout(5000); // the prefetch starts after about one second
    expect(files.count()).toBe(known);
    expect(files.has("SupportList")).toBe(false);
  });
});

test("a jobseeker gets the jobseeker pages and none of the staff pages", async ({
  page,
}) => {
  test.setTimeout(SLOW + 30_000);
  const files = watchFiles(page);
  await page.goto("/login");
  await page.locator("#email").fill(jobseekers.sin.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/onboarding-consent");
  await expect
    .poll(() => files.has("JobSeekerPositions"), { timeout: SLOW })
    .toBe(true);
  await page.waitForTimeout(3000); // let anything wrongly queued behind it show up
  for (const name of [
    "ProfileVerificationPending",
    "JobSeekerProfile",
    "TermsOfService",
  ])
    expect(files.has(name), name).toBe(true);
  for (const name of [
    "CalendarPage",
    "ClientManagement",
    "JobSeekerManagement",
    "Reports",
    "SupportList",
    "InvoiceList",
    "FeatureFlagsPage",
  ])
    expect(files.has(name), name).toBe(false);
});
