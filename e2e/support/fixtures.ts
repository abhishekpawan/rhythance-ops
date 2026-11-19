import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test as base, type Page } from "@playwright/test";
import { FIXED_NOW } from "../../server/tests/seed/ids.mjs";
import { PASSWORD, SMS_CODE, type Account } from "./accounts";
import {
  blockOutside,
  KNOWN_OUTSIDE_HOSTS,
  OUTSIDE_LOG,
} from "./outside-requests";

export type Language = "en" | "fr";

type Fixtures = {
  /** The language the app starts in (its own localStorage key); default English. */
  language: Language;
  /** Requests to hosts other than this machine that the page tried; all were aborted. */
  outsideRequests: { host: string; url: string }[];
};

export const test = base.extend<Fixtures>({
  language: ["en", { option: true }],

  baseURL: async ({}, use) => {
    if (!process.env.E2E_CLIENT_URL)
      throw new Error(
        "the client was not started (see support/global-setup.ts)"
      );
    await use(process.env.E2E_CLIENT_URL);
  },

  // runs for every test: block everything outside this machine, fail on a host nobody knows about
  outsideRequests: [
    async ({ context }, use, testInfo) => {
      mkdirSync(path.dirname(OUTSIDE_LOG), { recursive: true });
      const tried = await blockOutside(context, testInfo.titlePath.join(" > "));
      await use(tried);
      const unknown = [...new Set(tried.map((t) => t.host))].filter(
        (h) => !(h in KNOWN_OUTSIDE_HOSTS)
      );
      expect(
        unknown,
        `the page tried to reach hosts outside this machine (aborted): ${tried
          .filter((t) => unknown.includes(t.host))
          .map((t) => t.url)
          .join(", ")}`
      ).toEqual([]);
    },
    { auto: true },
  ],

  page: async ({ page, language, context }, use) => {
    // the browser's clock stands still at the same moment as the test server's (10:00 on 17 November 2026
    // in Toronto): the week lists and default dates the client works out from "today" are then the same
    // on every run. Timers keep running, so waits and token refresh still work.
    await context.clock.setFixedTime(FIXED_NOW);
    await page.addInitScript((lang) => {
      // once per tab, on its first page: a browser state saved by another run (storageState) may hold
      // another language, and a journey that switches the language itself must not be switched back
      if (!sessionStorage.getItem("e2e-language-set")) {
        sessionStorage.setItem("e2e-language-set", "1");
        localStorage.setItem("app-language", lang);
      }
    }, language);
    await use(page);
  },
});

export { expect };

/**
 * Signs in through the login form like a person: email and password; staff accounts (admin and the
 * recruiter roles) then get the two-step code, which the test server's SMS stand-in approves as 000000.
 * Resolves when the app has moved on to /dashboard.
 */
export async function signIn(page: Page, account: Account, twoStep: boolean) {
  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  if (twoStep) {
    await page.waitForURL("**/two-factor-auth");
    // the page sends the code on its own when it opens; wait for its "code sent" message
    await page.locator(".success-message").waitFor();
    // the screen sends the code again (and clears the field) when the app finishes loading its settings,
    // so type only once the page is quiet, and check the digits are still there before sending them
    await page.waitForLoadState("networkidle");
    const field = page.locator("input.otp-input");
    await expect(async () => {
      await field.fill(SMS_CODE);
      await expect(field).toHaveValue(SMS_CODE, { timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await field.press("Enter");
  }
  await page.waitForURL("**/dashboard");
}
