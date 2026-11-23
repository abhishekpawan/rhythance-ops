// Three read-only screens in the real browser, in English and French: the calendar (a seeded month, then a day), the
// training page (the list, then one module) and the email template previews (two templates). Nothing is changed or
// sent: the email previews are rendered by the server from sample data.
//
// What is pinned: each screen as plain text (tests/__snapshots__/calendar-training-email/) and the requests the
// calendar sends for its month. The browser's clock stands at 17 November 2026 and the seed's positions and
// assignments (server/tests/seed/data.sql) fall in that month: two positions, four assignments, one open place.
import { type Page } from "@playwright/test";
import { expect, test, type Language } from "../support/fixtures";
import { screenText } from "../support/screen";

const state = (role: string) => `.auth/${role}.json`;
const snap = (name: string, language: Language) => [
  "calendar-training-email",
  `${name}.${language}.txt`,
];

async function open(page: Page, path: string, language: Language) {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

for (const language of ["en", "fr"] as const) {
  test.describe(`in ${language}`, () => {
    test.use({ language });

    test.describe("calendar", () => {
      test.use({ storageState: state("admin") });

      test("a seeded month and a day of it", async ({ page }) => {
        const events = page.waitForRequest(
          (r) =>
            new URL(r.url()).pathname === "/api/calendar" &&
            new URL(r.url()).search ===
              "?startDate=2026-11-01&endDate=2026-11-30"
        );
        await open(page, "/calendar", language);
        await events;
        await expect(page.locator(".rbc-event").first()).toBeVisible();
        await expect(
          page.locator(".calendar-page .loading-spinner, .skeleton-title")
        ).toHaveCount(0);
        expect(await screenText(page, ".calendar-page")).toMatchSnapshot(
          snap("calendar-month", language)
        );

        // a day in the middle of the month: click its cell (the number on it opens the calendar's own day view and
        // leaves the panel on today), and the panel lists what falls on that day
        const cells = page.locator(
          ".rbc-month-view .rbc-month-row .rbc-day-bg"
        );
        const numbers = await page
          .locator(".rbc-month-view .rbc-date-cell")
          .allInnerTexts();
        const index = numbers.findIndex((n, i) => n.trim() === "20" && i > 10);
        expect(index).toBeGreaterThan(10);
        await cells.nth(index).click({ position: { x: 4, y: 4 }, force: true });
        await expect(page.locator(".day-view-panel")).toContainText(
          "November 20, 2026"
        );
        expect(await screenText(page, ".calendar-page")).toMatchSnapshot(
          snap("calendar-day-20", language)
        );
      });
    });

    test.describe("training", () => {
      test.use({ storageState: state("admin") });

      test("the list, then one module that is coming soon", async ({
        page,
      }) => {
        await open(page, "/training-modules", language);
        await expect(page.locator(".module-card").first()).toBeVisible();
        expect(await screenText(page, ".dashboard-container")).toMatchSnapshot(
          snap("training-list", language)
        );

        // the videos open YouTube, which no journey may reach: a module that is coming soon opens its own window
        await page.locator(".module-card.coming-soon-module").first().click();
        await expect(
          page
            .locator(".modal-overlay, .coming-soon-modal, [role=dialog]")
            .first()
        ).toBeVisible();
        expect(await screenText(page, "body")).toMatchSnapshot(
          snap("training-module", language)
        );
      });

      test("a module window: Escape closes it and the focus goes back to the module that opened it", async ({
        page,
      }) => {
        // the video window embeds YouTube: that address is answered here with an empty page, so no request leaves
        // this machine
        await page.route("https://www.youtube.com/**", (route) =>
          route.fulfill({ contentType: "text/html", body: "<html></html>" })
        );
        await open(page, "/training-modules", language);
        await expect(page.locator(".module-card").first()).toBeVisible();
        // the last video card: its video is the same before and after the portal's own two have loaded
        const cards = {
          "coming soon": page
            .locator(".module-card.coming-soon-module")
            .first(),
          video: page.locator(".module-card.video-module").last(),
        };
        const windows = {
          "coming soon": page.locator(".coming-soon-modal-backdrop"),
          video: page.locator(".video-modal-backdrop"),
        };
        for (const kind of ["coming soon", "video"] as const) {
          // a click gives the card the focus, as it does a person's
          await cards[kind].click();
          await expect(windows[kind]).toBeVisible();
          await expect(page.getByRole("dialog")).toHaveCount(1);
          await page.keyboard.press("Escape");
          await expect(windows[kind]).toHaveCount(0);
          await expect(cards[kind]).toBeFocused();
        }
      });
    });

    test.describe("email template previews", () => {
      test.use({ storageState: state("superadmin") });

      test("open the first template and two the server renders", async ({
        page,
      }) => {
        await open(page, "/email-template-preview", language);
        await expect(page.locator(".etp-sidebar-item")).toHaveCount(10);
        const frameText = async () => {
          const body = page.frameLocator(".etp-iframe").locator("body");
          await expect(body).not.toBeEmpty();
          return (await body.innerText()).replace(/\s+/g, " ").trim();
        };
        const snapshot = async (id: string) => {
          const text = await screenText(page, ".etp-page");
          expect(`${text}IFRAME: ${await frameText()}\n`).toMatchSnapshot(
            snap(`email-${id}`, language)
          );
        };
        // the page opens on the first template of its list and asks for its preview on its own
        await expect(page.locator(".etp-preview-title")).toHaveText(
          "Recruiter Invitation"
        );
        await snapshot("recruiter-invitation");
        // the others are asked for when clicked: the server renders them from sample data
        for (const [id, name] of [
          ["timesheet", "Timesheet Summary"],
          ["invoice", "Invoice"],
        ] as const) {
          const asked = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === `/api/email-templates/${id}/preview`
          );
          await page
            .locator(".etp-sidebar-item", { hasText: name })
            .first()
            .click();
          expect((await asked).status()).toBe(200);
          await expect(page.locator(".etp-preview-title")).toHaveText(name);
          await snapshot(id);
        }
      });
    });
  });
}
