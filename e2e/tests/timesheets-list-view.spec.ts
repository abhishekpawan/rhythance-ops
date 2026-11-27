// Timesheets, the list, the view and who may open which screen (R-4, gate d), in English and in French.
//   /timesheet-management/list          the list with its filters and paging, as the admin
//   /timesheet-management/view/:id      one timesheet as text
//   who may open the six timesheet screens, role by role (the screens answer by sending the others to the dashboard)
//
// The list reads the nine seeded timesheets; the paging case adds four of its own (weeks of 2025, removed after) so that
// there are two pages. The list orders by the day a row was made and the seed made four of its rows at one moment, so
// the tables are compared with their rows in order of their text; which rows are on a page is fixed (page one ends where
// a group of rows made at the same moment ends).
//
// The timesheet screens make no PDF and no print view: the view offers "Download PDF" only for a timesheet that has a
// stored document, which no screen of the portal creates (the seed has none), so the view is captured as text.
import { type Page } from "@playwright/test";
import { expect, signIn, test as base } from "../support/fixtures";
import { jobseekers, PASSWORD, staff } from "../support/accounts";
import { screenText } from "../support/screen";
import { tableText } from "../support/ui";
import {
  CLIENT,
  POSITION,
  PROFILE,
  SEEDED_TIMESHEET,
  USER,
  createThroughServer,
  days,
  sweepTimesheets,
  weekStart,
} from "../support/timesheet-screens";

base.describe.configure({ mode: "serial" });

const LIST = "/timesheet-management/list";

/** The list's own requests: what the screen asked the server, in order. */
function watchList(page: Page) {
  const urls: URL[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/timesheets" && r.method() === "GET") urls.push(u);
  });
  return urls;
}

/** A page of the table once the screen is quiet: the loader is gone and the last answer is the one drawn. */
async function listTable(page: Page, rows: number) {
  // Right after a change (page size, page, filter) the old rows can still be drawn, so "no loader" holds before the
  // loader starts; the loader then draws one placeholder row per row of the new page, which a plain row count would
  // take for the answer (seen in CI after the page size went to 10). So count only real rows, wait for text in the
  // first cell, and check the loader is gone.
  const real = page.locator(".common-table tbody tr:not(.skeleton-row)");
  await expect(real).toHaveCount(rows);
  if (rows > 0)
    await expect(real.first().locator("td").first()).not.toHaveText(/^\s*$/);
  await expect(page.locator(".skeleton-row")).toHaveCount(0);
  return tableText(page, { sortRows: true });
}

const filter = (page: Page, nth: number) =>
  page.locator(".column-search-input").nth(nth);

for (const language of ["en", "fr"] as const) {
  base.describe(`list in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepTimesheets);
    base.afterEach(sweepTimesheets);

    base("the list and its filters", async ({ page }) => {
      const asked = watchList(page);
      await page.goto(LIST);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      // every seeded timesheet, 25 to a page by default: one page, no bottom bar
      expect(await listTable(page, 9)).toMatchSnapshot([
        "timesheets",
        `list-all.${language}.txt`,
      ]);
      await expect(page.locator(".pagination-controls.bottom")).toHaveCount(0);

      // each filter is a request with its own parameter, and the table shows what the server answers
      const cases: Array<[string, number, string, string, number]> = [
        ["invoice", 0, "900002", "invoiceNumberFilter", 2],
        ["client", 1, "Quebec", "clientFilter", 1],
        ["position", 2, "Loader", "positionFilter", 2],
        ["jobseeker", 3, "Casey", "jobseekerFilter", 1],
      ];
      for (const [name, nth, text, param, rows] of cases) {
        const before = asked.length;
        await filter(page, nth).fill(text);
        await expect
          .poll(() =>
            asked.slice(before).some((u) => u.searchParams.get(param) === text)
          )
          .toBe(true);
        expect(await listTable(page, rows)).toMatchSnapshot([
          "timesheets",
          `list-filter-${name}.${language}.txt`,
        ]);
        await filter(page, nth).fill("");
        await expect(page.locator(".common-table tbody tr")).toHaveCount(9);
      }
    });

    base("paging: two pages, then back", async ({ page }) => {
      // four timesheets of the jobseeker Sam in weeks of 2025, so there are 13 and the list has a second page
      for (let i = 0; i < 4; i++) {
        const start = weekStart(20 + i);
        await createThroughServer({
          jobseeker_profile_id: PROFILE.sin,
          jobseeker_user_id: USER.sin,
          position_id: POSITION.warehouse,
          week_start_date: start,
          week_end_date: days(start, [0, 0, 0, 0, 0, 0, 0])[6].date,
          daily_hours: days(start, [0, 8, 8, 8, 8, 8, 0]),
          total_regular_hours: 40,
          total_overtime_hours: 0,
          regular_pay_rate: 20,
          premium_pay_rate: 0,
          overtime_pay_rate: 20,
          regular_bill_rate: 35,
          overtime_bill_rate: 35,
          total_jobseeker_pay: 800,
          total_client_bill: 1400,
          overtime_enabled: false,
          notes: "",
          email_sent: false,
          invoice_number: `81000${i + 1}`,
        });
      }
      void CLIENT;
      const asked = watchList(page);
      await page.goto(LIST);
      // the screen starts with 25 to a page: ten to a page makes two
      await expect(page.locator(".common-table tbody tr")).toHaveCount(13);
      await page.locator("#pageSize").selectOption("10");
      expect(await listTable(page, 10)).toMatchSnapshot([
        "timesheets",
        `list-page-1.${language}.txt`,
      ]);
      const bar = page.locator(".pagination-controls.bottom");
      await expect(bar).toBeVisible();
      const before = asked.length;
      await bar.locator("button.pagination-btn.next").click();
      await expect
        .poll(() =>
          asked.slice(before).some((u) => u.searchParams.get("page") === "2")
        )
        .toBe(true);
      expect(await listTable(page, 3)).toMatchSnapshot([
        "timesheets",
        `list-page-2.${language}.txt`,
      ]);
      // a page of 25 puts all of them on one page again
      await page.locator("#pageSize").selectOption("25");
      await listTable(page, 13);
      await expect(page.locator(".pagination-controls.bottom")).toHaveCount(0);
    });
  });

  base.describe(`view in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    // the seeded timesheets: 51 SIN, 52 overtime, 53 cash, 54 hybrid (SIN row), 56 corporation, 57 hybrid with a bonus
    for (const n of [51, 52, 53, 54, 56, 57]) {
      base(`timesheet ${n} as text`, async ({ page }) => {
        await page.goto(`/timesheet-management/view/${SEEDED_TIMESHEET(n)}`);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(
          page.locator(".timesheet-view-card").first()
        ).toBeVisible();
        await expect(
          page.locator(".timesheet-view-loading-container")
        ).toHaveCount(0);
        expect(
          await screenText(page, ".timesheet-view-page-container")
        ).toMatchSnapshot(["timesheets", `view-${n}.${language}.txt`]);
      });
    }
  });
}

// ---- where "Edit" leads (R-4b): the list's button and the view's button build the same link -------------------------------

base.describe("the edit buttons", () => {
  base.use({ language: "en", storageState: ".auth/admin.json" });
  base.afterEach(sweepTimesheets);

  // the seeded timesheet 51 (Sam, Warehouse Associate at Northwind, the week of 1 November 2026) is a single-position one
  const SINGLE = `/timesheet-management?profileId=${PROFILE.sin}&clientId=${CLIENT.northwind}&positionId=${POSITION.warehouse}&weekStart=2026-11-01`;

  base(
    "the list and the view open the entry screen on that week",
    async ({ page }) => {
      await page.goto(LIST);
      await expect(page.locator(".skeleton-row")).toHaveCount(0);
      await page
        .locator(".common-table tbody tr", { hasText: "# 900001" })
        .filter({ hasText: "Sam Sinclair" })
        .locator(".edit-btn")
        .click();
      await page.waitForURL("**/timesheet-management?**");
      expect(page.url().replace(/^https?:\/\/[^/]+/, "")).toBe(SINGLE);

      await page.goto(`/timesheet-management/view/${SEEDED_TIMESHEET(51)}`);
      await page.getByRole("button", { name: "Edit Timesheet" }).click();
      await page.waitForURL("**/timesheet-management?**");
      expect(page.url().replace(/^https?:\/\/[^/]+/, "")).toBe(SINGLE);
    }
  );

  base(
    "a bulk timesheet opens the bulk-by-jobseeker screen",
    async ({ page }) => {
      const start = weekStart(20);
      await createThroughServer({
        jobseeker_profile_id: PROFILE.sin,
        jobseeker_user_id: USER.sin,
        position_id: POSITION.warehouse,
        week_start_date: start,
        week_end_date: days(start, [0, 0, 0, 0, 0, 0, 0])[6].date,
        daily_hours: days(start, [0, 8, 8, 8, 8, 8, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 800,
        total_client_bill: 1400,
        overtime_enabled: false,
        notes: "",
        email_sent: false,
        invoice_number: "810001",
        is_bulk: true,
        bulk_breakdown: [],
      });
      await page.goto(LIST);
      await expect(page.locator(".skeleton-row")).toHaveCount(0);
      await page
        .locator(".common-table tbody tr", { hasText: "# 810001" })
        .locator(".edit-btn")
        .click();
      await page.waitForURL("**/bulk-timesheet-management/jobseeker?**");
      expect(page.url().replace(/^https?:\/\/[^/]+/, "")).toBe(
        `/bulk-timesheet-management/jobseeker?profileId=${PROFILE.sin}&clientId=${CLIENT.northwind}&positionId=${POSITION.warehouse}&weekStart=${start}`
      );
    }
  );
});

// ---- who may open which screen ---------------------------------------------------------------------------------------

const SCREENS = [
  ["entry", "/timesheet-management"],
  ["list", LIST],
  ["view", `/timesheet-management/view/${SEEDED_TIMESHEET(51)}`],
  ["bulk by client", "/bulk-timesheet-management"],
  ["bulk by jobseeker", "/bulk-timesheet-management/jobseeker"],
  ["bulk list", "/bulk-timesheet-management/list"],
] as const;

for (const language of ["en", "fr"] as const) {
  base.describe(`who may open the timesheet screens, in ${language}`, () => {
    base.use({ language });
    // the roles that start signed in (tests/auth.setup.ts) ...
    for (const role of [
      "admin",
      "recruiter",
      "bookkeeper",
      "accountant_manager",
      "sales",
      "superadmin",
    ]) {
      base.describe(`${role}`, () => {
        base.use({ storageState: `.auth/${role}.json` });
        base(`opens`, async ({ page }) => {
          const where = await landings(page, language);
          expect(where.join("\n") + "\n").toMatchSnapshot([
            "timesheets",
            `who-${role}.txt`,
          ]);
        });
      });
    }
    // ... and the two staff roles that do not, signed in through the form (and the phone code)
    for (const key of ["recruiter_manager", "recruiter_director"] as const) {
      base(`${key}`, async ({ page }) => {
        await signIn(page, staff[key], true);
        const where = await landings(page, language);
        expect(where.join("\n") + "\n").toMatchSnapshot([
          "timesheets",
          `who-${key}.txt`,
        ]);
      });
    }
    // a jobseeker is held on the employment agreement (the seeded jobseekers have not signed it), whatever they open
    base("jobseeker", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill(jobseekers.sin.email);
      await page.locator("#password").fill(PASSWORD);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL("**/onboarding-consent");
      const where = await landings(page, language);
      expect(where.join("\n") + "\n").toMatchSnapshot([
        "timesheets",
        "who-jobseeker.txt",
      ]);
    });
  });
}

/** Where each screen leaves the person: the path they end on after the page has settled. */
async function landings(page: Page, language: string) {
  const out: string[] = [];
  for (const [name, path] of SCREENS) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.waitForLoadState("networkidle");
    out.push(`${name}: ${path} -> ${new URL(page.url()).pathname}`);
  }
  return out;
}
