// The three admin screens a super admin or admin uses to set up a portal, through the real browser, in English and
// French: the feature flags (/feature-flags), the portal settings (/portal-settings) and the dropdown options
// (/admin/dropdown-options). Each is read, changed and put back; the admin who may not open the first two is sent away.
//
// What is pinned: the screen as plain text (tests/__snapshots__/admin-pages/), and the request every change sends
// (worked out from the screens' code, never copied from a run). What the journeys change is put back in the same
// test (a flag reset to its default, a setting cleared, the added option deleted), so the rest of the suite sees the
// seed. The tests run one after the other in this file: they all write to the same few rows.
import { type Page, type Request } from "@playwright/test";
import { expect, test, type Language } from "../support/fixtures";
import { screenText } from "../support/screen";

test.describe.configure({ mode: "serial" });

const state = (role: string) => `.auth/${role}.json`;
const snap = (name: string, language: Language) => [
  "admin-pages",
  `${name}.${language}.txt`,
];

async function open(page: Page, path: string, language: Language) {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

const isCall = (method: string, path: string, body?: unknown) => (r: Request) =>
  r.method() === method &&
  new URL(r.url()).pathname === path &&
  (body === undefined ||
    JSON.stringify(r.postDataJSON()) === JSON.stringify(body));

for (const language of ["en", "fr"] as const) {
  test.describe(`in ${language}`, () => {
    test.use({ language });

    test.describe("super admin", () => {
      test.use({ storageState: state("superadmin") });

      test("feature flags: read the list, switch one on and put it back to its default", async ({
        page,
      }) => {
        await open(page, "/feature-flags", language);
        await expect(page.locator(".ff-card")).toHaveCount(7);
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("flags-list", language)
        );

        // jobseeker payroll cards: off by default, read only on the jobseeker dashboard, which no journey opens
        const key = "jobseeker_payroll_summary";
        const card = page.locator(".ff-card", {
          has: page.locator(`code:text-is("${key}")`),
        });
        const sw = card.getByRole("switch");
        await expect(sw).toHaveAttribute("aria-checked", "false");

        const put = page.waitForRequest(
          isCall("PUT", `/api/feature-flags/${key}`, { enabled: true })
        );
        await sw.click();
        await page.locator(".confirmation-modal").waitFor();
        await page
          .locator(".confirmation-modal .modal-actions button")
          .last()
          .click();
        await put;
        await expect(sw).toHaveAttribute("aria-checked", "true");
        await expect(card.locator(".ff-reset")).toBeVisible();
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("flags-switched-on", language)
        );

        const del = page.waitForRequest(
          isCall("DELETE", `/api/feature-flags/${key}`)
        );
        await card.locator(".ff-reset").click();
        await del;
        await expect(sw).toHaveAttribute("aria-checked", "false");
        await expect(card.locator(".ff-reset")).toHaveCount(0);
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("flags-back-to-default", language)
        );
      });

      test("portal settings: read, change one text and put it back", async ({
        page,
      }) => {
        await open(page, "/portal-settings", language);
        await expect(
          page.locator(".ps-fields .ff-setting").first()
        ).toBeVisible();
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("settings-list", language)
        );

        const field = page
          .locator(".ff-setting", { hasText: /^Address line 1/ })
          .locator("input");
        await expect(field).toHaveValue("");
        await field.fill("1 Journey Street");
        const save = page.locator("button.ps-save");
        // the bar above the fields counts the unsaved changes (it has a number in it) until the save has gone through
        const saved = () =>
          expect(page.locator(".ps-actionbar-text")).not.toHaveText(/\d/);
        const put = page.waitForRequest(
          isCall("PUT", "/api/portal-settings", {
            values: { "company.address": "1 Journey Street" },
          })
        );
        await save.click();
        await put;
        await saved();
        await expect(field).toHaveValue("1 Journey Street");
        await expect(save).toBeDisabled();
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("settings-changed", language)
        );

        // an empty text takes the stored value away (the setting is its default again)
        await field.fill("");
        const clear = page.waitForRequest(
          isCall("PUT", "/api/portal-settings", {
            values: { "company.address": "" },
          })
        );
        await save.click();
        await clear;
        await saved();
        await expect(field).toHaveValue("");
        await expect(save).toBeDisabled();
        expect(await screenText(page, ".ff-page")).toMatchSnapshot(
          snap("settings-back-to-default", language)
        );
      });

      test("dropdown options: read a list, add an option and delete it", async ({
        page,
      }) => {
        await open(page, "/admin/dropdown-options", language);
        await expect(page.locator(".dopts-list-item").first()).toBeVisible();
        expect(
          await screenText(page, ".dropdown-options-management")
        ).toMatchSnapshot(snap("dropdowns-list", language));

        const name = `Journey Option ${language}`;
        await page.locator("#dopts-new-name").fill(name);
        const post = page.waitForRequest(
          isCall("POST", "/api/dropdown-options", {
            listType: "client_manager",
            name,
            displayOrder: 0,
          })
        );
        await page.locator(".dopts-btn-add").click();
        await post;
        const row = page.locator(".dopts-list-item", { hasText: name });
        await expect(row).toHaveCount(1);
        expect(
          (await screenText(page, ".dropdown-options-management")).replace(
            new RegExp(name, "g"),
            "<new option>"
          )
        ).toMatchSnapshot(snap("dropdowns-added", language));

        page.once("dialog", (d) => void d.accept());
        const del = page.waitForRequest(
          (r) =>
            r.method() === "DELETE" &&
            new URL(r.url()).pathname.startsWith("/api/dropdown-options/")
        );
        await row.locator(".dopts-btn-icon--danger").click();
        await del;
        await expect(row).toHaveCount(0);
        expect(
          await screenText(page, ".dropdown-options-management")
        ).toMatchSnapshot(snap("dropdowns-deleted", language));
      });
    });

    test.describe("admin", () => {
      test.use({ storageState: state("admin") });

      test("feature flags and portal settings are for the super admin: the admin is sent to the dashboard", async ({
        page,
      }) => {
        for (const path of ["/feature-flags", "/portal-settings"]) {
          await page.goto(path);
          await page.waitForURL("**/dashboard");
        }
      });

      test("dropdown options: the admin opens the page", async ({ page }) => {
        await open(page, "/admin/dropdown-options", language);
        await expect(page.locator(".dopts-list-item").first()).toBeVisible();
        expect(
          await screenText(page, ".dropdown-options-management")
        ).toMatchSnapshot(snap("dropdowns-list", language));
      });
    });
  });
}
