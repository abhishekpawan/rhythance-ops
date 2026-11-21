// Moving to a page whose code is not downloaded yet must look like moving between pages always did: the header and
// the side menu stay, the page that was open stays until the next one is ready, and the screen is never blank
// (a Suspense spinner that replaced the whole screen did that for about half a second after the pages were split,
// SPEED-1 follow-up). Runs on the production build only, where each page is a file of its own:
// `E2E_CLIENT=build pnpm test:e2e`. The next page's file is held for 1.5 s, and the browser is made to ask for
// "save data" so that the background download of the other pages (prefetch.spec.ts) does not fetch it first.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";

test.skip(
  process.env.E2E_CLIENT !== "build",
  "needs the production build (E2E_CLIENT=build)"
);
test.use({ storageState: ".auth/admin.json" });

const HELD_MS = 1500;
const CALENDAR_FILE = /\/assets\/CalendarPage-[\w-]+\.js$/;
const DASHBOARD_FILE = /\/assets\/Dashboard-[\w-]+\.js$/;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    });
  });
});

/** Holds the answer to a file for HELD_MS, then tells watchFrames() to stop judging: the next page may draw its own
 * loading state after that. Resolves with the number of times the file was asked for. */
async function hold(page: Page, file: RegExp) {
  const asked = { count: 0 };
  await page.route(file, async (route) => {
    asked.count++;
    await new Promise((r) => setTimeout(r, HELD_MS));
    await page
      .evaluate(() => {
        (window as unknown as { __released: boolean }).__released = true;
      })
      .catch(() => undefined); // the page may be loading (a first visit): nothing is being watched then
    await route.continue();
  });
  return asked;
}

/**
 * From now on, on every screen frame until the held file is released: is the header on screen, the side menu, and
 * the page that was open? (a Suspense fallback replaces all three). Returns what was found wrong, as text.
 */
async function watchFrames(page: Page, openPage: string) {
  await page.evaluate((selector) => {
    const wrong = new Set<string>();
    const shown = (query: string) => {
      const element = document.querySelector<HTMLElement>(query);
      return !!element && element.getClientRects().length > 0;
    };
    const frame = () => {
      if ((window as unknown as { __released?: boolean }).__released) return;
      if (!shown("header.common-header")) wrong.add("the header is gone");
      if (!shown("nav.hamburger-menu")) wrong.add("the side menu is gone");
      if (!shown(selector)) wrong.add("the open page is gone");
      if (!document.body.innerText.trim()) wrong.add("the screen is blank");
      (window as unknown as { __wrong: Set<string> }).__wrong = wrong;
      requestAnimationFrame(frame);
    };
    frame();
  }, openPage);
  return () =>
    page.evaluate(() => [
      ...((window as unknown as { __wrong?: Set<string> }).__wrong ?? []),
    ]);
}

test("a click on a menu link keeps the header, the menu and the open page until the next page is ready", async ({
  page,
}) => {
  const asked = await hold(page, CALENDAR_FILE);
  await page.goto("/dashboard");
  await page.locator(".dashboard-heading").waitFor();
  expect(asked.count).toBe(0); // not downloaded yet: this is the case that used to blank the screen
  const wrong = await watchFrames(page, ".dashboard-heading");

  const clicked = Date.now();
  await page.locator('nav.hamburger-menu a[href="/calendar"]').click();
  // the address already changed; the screen has not
  await expect(page).toHaveURL(/\/calendar$/);
  await page.waitForTimeout(HELD_MS / 2);
  await expect(page.locator(".dashboard-heading")).toBeVisible();
  await expect(page.locator(".calendar-page")).toHaveCount(0);

  await expect(page.locator(".calendar-page")).toBeVisible();
  expect(Date.now() - clicked).toBeGreaterThanOrEqual(HELD_MS - 200); // it really waited for the file
  expect(asked.count).toBe(1);
  expect(await wrong()).toEqual([]);
});

test("the browser's back button to a page that is not downloaded yet keeps the screen too", async ({
  page,
}) => {
  const asked = await hold(page, DASHBOARD_FILE);
  // the Calendar is the first page here, so the Dashboard's file was never asked for ...
  await page.goto("/calendar");
  await page.locator(".calendar-page").waitFor();
  // ... and the entry before this one in the history is the Dashboard (the app is not told about it)
  await page.evaluate(() => {
    window.history.replaceState(null, "", "/dashboard");
    window.history.pushState(null, "", "/calendar");
  });
  expect(asked.count).toBe(0);
  const wrong = await watchFrames(page, ".calendar-page");

  const pressed = Date.now();
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForTimeout(HELD_MS / 2);
  await expect(page.locator(".calendar-page")).toBeVisible();
  await expect(page.locator(".dashboard-heading")).toHaveCount(0);

  await expect(page.locator(".dashboard-heading")).toBeVisible();
  expect(Date.now() - pressed).toBeGreaterThanOrEqual(HELD_MS - 200);
  expect(asked.count).toBe(1);
  expect(await wrong()).toEqual([]);
});

test("a page opened first (a new tab on its address) shows the app's spinner, not a blank screen", async ({
  page,
}) => {
  await hold(page, DASHBOARD_FILE);
  await page.goto("/dashboard", { waitUntil: "commit" });
  // the loader of the app (components/Loader.tsx) draws a real spinner with a message while the file is held
  await expect(page.locator(".app-loader-spinner")).toBeVisible();
  const box = await page.locator(".app-loader-spinner").boundingBox();
  expect(box?.width).toBeGreaterThan(10);
  await expect(page.locator(".dashboard-heading")).toBeVisible();
});
