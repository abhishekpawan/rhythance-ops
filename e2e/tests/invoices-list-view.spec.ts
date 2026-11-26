// Invoices, the list, the view and who may open which screen (R-5, gate d), in English and in French.
//   /invoice-management/list           the list with its filters and paging, as the admin
//   /invoice-management/view/:id       one invoice as text (the five seeded ones)
//   who may open the screens, role by role (the screens answer by sending the others to the dashboard)
//
// The filters are set through the address (`?client=Pacific`, `?emailSent=true` ...: the list reads them on opening),
// and one case types into the search box. The list reads the five seeded invoices; the paging case adds ten of its own
// (numbers 81xxxx, removed after) so that, ten to a page, there are two pages. The seeded invoices were made at
// different times, so the list has no ties and its order is pinned as it is.
import { type Page } from "@playwright/test";
import { expect, signIn, test as base } from "../support/fixtures";
import { jobseekers, PASSWORD, staff } from "../support/accounts";
import { screenText } from "../support/screen";
import { tableText } from "../support/ui";
import {
  CLIENT,
  SEEDED_INVOICE,
  createThroughServer,
  sweepInvoices,
} from "../support/invoice-screens";

base.describe.configure({ mode: "serial" });

const LIST = "/invoice-management/list";

/** The list once the screen is quiet: the loader is gone and the rows are drawn. */
async function listTable(page: Page, rows: number) {
  await expect(page.locator(".skeleton-row")).toHaveCount(0);
  await expect(page.locator(".common-table tbody tr")).toHaveCount(rows);
  return tableText(page);
}

const FILTERS: Array<[string, string, number]> = [
  ["no filter", "", 5],
  ["search finds a client name", "?searchTerm=Quebec", 1],
  ["search finds an invoice number", "?searchTerm=900001", 1],
  ["search finds nothing", "?searchTerm=nothing-has-this", 0],
  ["client", "?client=Pacific", 1],
  ["client email", "?clientEmail=nora", 2],
  ["invoice number", "?invoiceNumber=90000", 5],
  ["invoice number, one", "?invoiceNumber=900005", 1],
  ["emailed: yes", "?emailSent=true", 3],
  ["emailed: no", "?emailSent=false", 2],
  [
    "invoice date from and to",
    "?dateRangeStart=2026-11-01&dateRangeEnd=2026-11-12",
    3,
  ],
  ["payment terms (the seeded ones store none)", "?paymentTerms=Net%2030", 0],
  ["a client and emailed together", "?client=Northwind&emailSent=false", 1],
  ["PDF made: yes (none of the seeded)", "?documentGenerated=true", 0],
];

for (const language of ["en", "fr"] as const) {
  base.describe(`list in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepInvoices);
    base.afterEach(sweepInvoices);

    for (const [name, query, rows] of FILTERS) {
      base(`filter: ${name}`, async ({ page }) => {
        await page.goto(`${LIST}${query}`);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        expect(await listTable(page, rows)).toMatchSnapshot([
          "invoices",
          `list-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${language}.txt`,
        ]);
      });
    }

    base("typing in the search box and the reset button", async ({ page }) => {
      await page.goto(LIST);
      await listTable(page, 5);
      await page.locator(".filter-container input").first().fill("Prairie");
      await listTable(page, 1);
      await page.locator("button.reset-filters-btn").click();
      await listTable(page, 5);
    });

    base("two pages: ten to a page", async ({ page }) => {
      for (let i = 1; i <= 10; i++) {
        await createThroughServer({
          invoiceNumber: `8100${String(i).padStart(2, "0")}`,
          clientId: CLIENT.northwind,
          invoiceDate: "2026-11-17",
          dueDate: "2026-12-17",
          status: "draft",
          currency: "CAD",
          subtotal: 100,
          totalTax: 13,
          totalHst: 13,
          totalGst: 0,
          totalQst: 0,
          grandTotal: 113,
          totalHours: 4,
          invoiceData: { client: { id: CLIENT.northwind }, timesheets: [] },
        });
      }
      await page.goto(LIST);
      await expect(page.locator(".common-table tbody tr")).toHaveCount(15);
      await page.locator("#pageSize").selectOption("10");
      expect(await listTable(page, 10)).toMatchSnapshot([
        "invoices",
        `list-page-1.${language}.txt`,
      ]);
      const bar = page.locator(".pagination-controls.bottom");
      await expect(bar).toBeVisible();
      await bar.locator("button.pagination-btn.next").click();
      expect(await listTable(page, 5)).toMatchSnapshot([
        "invoices",
        `list-page-2.${language}.txt`,
      ]);
      await page.locator("#pageSize").selectOption("25");
      await listTable(page, 15);
      await expect(page.locator(".pagination-controls.bottom")).toHaveCount(0);
    });
  });

  base.describe(`view in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    const seeded = {
      ontario: "Ontario HST, sent",
      quebec: "Quebec GST and QST, draft",
      britishColumbia: "British Columbia GST, paid",
      alberta: "Alberta zero rated in USD, overdue",
      ontarioDeduction: "Ontario with a deduction line, draft",
    } as const;
    for (const [key, name] of Object.entries(seeded)) {
      base(`${name} as text`, async ({ page }) => {
        await page.goto(
          `/invoice-management/view/${SEEDED_INVOICE[key as keyof typeof SEEDED_INVOICE]}`
        );
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator(".invoice-view-table")).toBeVisible();
        expect(
          await screenText(page, ".invoice-view-page-container")
        ).toMatchSnapshot(["invoices", `view-${key}.${language}.txt`]);
      });
    }
    base("an invoice nobody has", async ({ page }) => {
      await page.goto(
        "/invoice-management/view/00000000-0000-4000-8000-0000000000ee"
      );
      await expect(page.locator(".invoice-view-loading-container")).toHaveCount(
        0
      );
      await expect(
        page.locator(".invoice-view-page-container")
      ).not.toContainText(/Loading|Chargement/);
      expect(
        await screenText(page, ".invoice-view-page-container")
      ).toMatchSnapshot(["invoices", `view-nobody.${language}.txt`]);
    });
  });
}

// ---- who may open which screen ---------------------------------------------------------------------------------------

const SCREENS = [
  ["create", "/invoice-management/create"],
  ["the page's other address", "/invoice-management"],
  ["list", LIST],
  ["view", `/invoice-management/view/${SEEDED_INVOICE.ontario}`],
  ["view without an id", "/invoice-management/view"],
] as const;

for (const language of ["en", "fr"] as const) {
  base.describe(`who may open the invoice screens, in ${language}`, () => {
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
            "invoices",
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
          "invoices",
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
        "invoices",
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
