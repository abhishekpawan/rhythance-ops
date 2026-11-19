// Every Reports screen, as the admin and as the accountant manager (a second staff role the client lets
// into Reports, REPORTS_ROLES), in English and in French. Each screen is driven like a person would
// (filters, then the CSV button) and three things are pinned:
//  - the request body the browser sends (the pattern for the Timesheets money journeys);
//  - the table as plain text;
//  - the CSV file the button downloads.
// The two roles must show exactly the same, so the snapshots are per screen and language, not per role.
import { type Page, type Request } from "@playwright/test";
import { expect, test as base } from "../support/fixtures";
import { SIGNED_IN_ROLES } from "../support/accounts";
import { REPORT_SCREENS, type ReportScreen } from "../support/report-screens";
import { downloadCsv, tableText } from "../support/ui";

/** Ids inside lists have no meaning in their order; the order of week periods does. */
const normalise = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.every((v) => typeof v === "string")
      ? [...value].sort()
      : value.map(normalise)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, normalise(v)])
        )
      : value;

/**
 * Opens the screen, sets its filters, and returns once the table shows the answer to the expected request.
 * `journal` collects what the screen asked and the order the answers came back (attached to the test).
 */
async function openAndFilter(
  page: Page,
  screen: ReportScreen,
  language: string,
  journal: string[]
) {
  const theEndpoint = (r: Request) =>
    new URL(r.url()).pathname === screen.endpoint && r.method() === "POST";
  const wanted = JSON.stringify(normalise(screen.body));
  const sent = page.waitForRequest(
    (r) =>
      theEndpoint(r) && JSON.stringify(normalise(r.postDataJSON())) === wanted,
    { timeout: 20_000 }
  );
  sent.catch(() => undefined); // reported where it is awaited below

  // every request the screen makes to its endpoint, in order
  const asked: Request[] = [];
  page.on("request", (r) => {
    if (!theEndpoint(r)) return;
    asked.push(r);
    journal.push(`asked #${asked.length}: ${r.postData()}`);
  });
  page.on("requestfinished", (r) => {
    if (theEndpoint(r)) journal.push(`answered #${asked.indexOf(r) + 1}`);
  });

  await page.goto(screen.path);
  // (a saved browser state from another language must not win)
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  // the filter lists (clients, job seekers...) are fetched when the screen opens
  await page.waitForLoadState("networkidle");
  await screen.drive(page);

  // the browser sent exactly this body, and the server answered it
  const request = await sent;
  expect(normalise(request.postDataJSON())).toEqual(normalise(screen.body));
  expect((await request.response())?.status()).toBe(200);

  // The screens can ask again after a filter, so a table can be an earlier answer, or be redrawn while it
  // is read. Read it only when the page is quiet, the last request it made is the expected one, and no new
  // request started while it was read.
  let table = "";
  await expect(async () => {
    const askedBefore = asked.length;
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".loading-indicator")).toHaveCount(0);
    await expect(page.locator(".error-message")).toHaveCount(0);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    table = await tableText(page, {
      sortRows: screen.unorderedRows,
      dropFirstColumn: screen.unorderedRows,
    });
    expect(asked.length).toBe(askedBefore);
    expect(normalise(asked[asked.length - 1].postDataJSON())).toEqual(
      normalise(screen.body)
    );
  }).toPass({ timeout: 20_000 });
  return table;
}

for (const role of SIGNED_IN_ROLES) {
  for (const language of ["en", "fr"] as const) {
    base.describe(`${role} in ${language}`, () => {
      base.use({ language, storageState: `.auth/${role}.json` });

      for (const screen of REPORT_SCREENS) {
        base(screen.name, async ({ page }, testInfo) => {
          const journal: string[] = [];
          try {
            const table = await openAndFilter(page, screen, language, journal);
            expect(table).toMatchSnapshot([
              "reports",
              `${screen.name}.${language}.table.txt`,
            ]);
            expect(
              await downloadCsv(page, { sortRows: screen.unorderedRows })
            ).toMatchSnapshot([
              "reports",
              `${screen.name}.${language}.csv.txt`,
            ]);
          } finally {
            await testInfo.attach("requests", {
              body: journal.join("\n"),
              contentType: "text/plain",
            });
          }
        });
      }
    });
  }
}
