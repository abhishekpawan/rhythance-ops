// A tab opened before a deploy asks for a page file the new deploy no longer has (SPEED-1 step 5). The client
// reloads once, which fetches the new index.html and with it the new file names; and it never reloads twice in a row.
// Runs on the production build only (the dev server has no hashed page files): `E2E_CLIENT=build pnpm test:e2e`.
// The "old file" is simulated by answering the Support page's file with a 404 (Vercel now answers a missing
// /assets/ file that way) the first time, or every time.
// The invoice PDF maker is the one file that is not a page: it is asked for when the invoice page opens, so that a
// missing file reloads before anything is typed, not at the end of "Generate invoice" after the invoice is saved.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";

test.skip(
  process.env.E2E_CLIENT !== "build",
  "needs the production build (E2E_CLIENT=build)"
);
test.use({ storageState: ".auth/admin.json" });

const SUPPORT_PAGE_FILE = /\/assets\/SupportList-[\w-]+\.js$/;
const PDF_MAKER_FILE = /\/assets\/pdfGenerator-[\w-]+\.js$/;

/** Opens the dashboard, then moves to /support inside the app (the page file is requested only now). */
async function openSupportFromDashboard(page: Page, answers: () => boolean) {
  let blocked = 0;
  await page.route(SUPPORT_PAGE_FILE, (route) => {
    if (answers()) {
      blocked++;
      return route.fulfill({ status: 404, body: "Not Found" });
    }
    return route.continue();
  });
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/dashboard");
  await page.locator(".dashboard-heading").waitFor();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/support");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  return { blocked: () => blocked, loads: () => loads };
}

test("the page file is gone once: one reload, then the page opens", async ({
  page,
}) => {
  let gone = true;
  const seen = await openSupportFromDashboard(page, () => {
    const answer = gone;
    gone = false; // the new deploy has it
    return answer;
  });
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.locator(".support-toolbar").first()).toBeVisible();
  expect(seen.blocked()).toBe(1);
  expect(seen.loads()).toBe(2); // the first load and exactly one reload
});

test("the page file stays missing: one reload, then no more (it cannot loop)", async ({
  page,
}) => {
  const seen = await openSupportFromDashboard(page, () => true);
  await expect.poll(() => seen.loads()).toBe(2);
  // proving that something does NOT happen needs a wait: give a second reload every chance to happen
  await page.waitForTimeout(3000);
  expect(seen.loads()).toBe(2);
  await expect(page.locator(".support-toolbar")).toHaveCount(0);
});

test("the invoice PDF maker's file is gone: the invoice page reloads when it opens", async ({
  page,
}) => {
  let gone = true;
  let blocked = 0;
  await page.route(PDF_MAKER_FILE, (route) => {
    if (!gone) return route.continue();
    gone = false; // the new deploy has it
    blocked++;
    return route.fulfill({ status: 404, body: "Not Found" });
  });
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/dashboard");
  await page.locator(".dashboard-heading").waitFor();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/invoice-management/create");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  // the page may draw before the answer to the missing file arrives; the reload follows it
  await expect.poll(() => loads).toBe(2); // the first load and exactly one reload, with nothing saved before it
  await expect(page.locator(".invoice-selection-bar").first()).toBeVisible();
  expect(blocked).toBe(1);
  expect(loads).toBe(2);
});
