// Small helpers for driving the portal's own widgets and turning what the page shows into plain text.
import { readFileSync } from "node:fs";
import { expect, type Download, type Page } from "@playwright/test";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// The envelope reports number their rows in the order the server answered ("NW-20261107-003"); rows with the
// same sort key come back in no fixed order (see the API pins' tiesBy), so the running number is masked
// when the rows are compared sorted. The API pins check that the numbers run 1..n.
const maskRunningNumber = (s: string) =>
  s.replace(/\b([A-Z]{1,5}-\d{8})-\d{3}\b/g, "$1-NNN");

/**
 * Chooses options in the n-th dropdown of the page (CustomDropdown). `labels` are matched as text inside the
 * option; "all" clicks the first entry ("Select All"). The menu is closed afterwards.
 */
export async function choose(page: Page, nth: number, ...labels: string[]) {
  const dropdown = page.locator(".custom-dropdown").nth(nth);
  const menu = dropdown.locator(".custom-dropdown-menu");
  const options = menu.locator(".custom-dropdown-option");
  // A dropdown whose list is still being fetched is replaced by a skeleton, then by a new dropdown (which
  // starts closed), and the positions shift while that happens. Keep trying until the menu is open and
  // holds its options; every try looks at the page again.
  await expect(async () => {
    await expect(page.locator(".invoice-dropdown-skeleton")).toHaveCount(0, {
      timeout: 1_000,
    });
    if (!(await menu.isVisible()))
      await dropdown.locator(".custom-dropdown-trigger").click();
    await expect(options.first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  for (const label of labels) {
    if (label === "all") await options.first().click();
    else await options.filter({ hasText: label }).first().click();
  }
  await page.mouse.click(2, 2); // a click outside closes the menu
  await expect(menu).toBeHidden();
}

/** The text of every table on the page: header cells, then one line per row, cells joined by " | ". */
export async function tableText(
  page: Page,
  { sortRows = false, dropFirstColumn = false } = {}
) {
  const tables = await page.locator("table").evaluateAll((all) =>
    all.map((table) => ({
      header: Array.from(table.querySelectorAll("thead th")).map(
        (th) => (th as HTMLElement).innerText
      ),
      rows: Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll("td")).map(
          (td) => (td as HTMLElement).innerText
        )
      ),
    }))
  );
  const lines: string[] = [];
  tables.forEach((table, i) => {
    const cut = (cells: string[]) =>
      (dropFirstColumn ? cells.slice(1) : cells).map(squash).join(" | ");
    lines.push(`TABLE ${i + 1}`, `HEADER: ${cut(table.header)}`);
    const rows = table.rows.map((r) =>
      sortRows ? maskRunningNumber(`ROW: ${cut(r)}`) : `ROW: ${cut(r)}`
    );
    lines.push(...(sortRows ? rows.sort() : rows));
  });
  return lines.join("\n") + "\n";
}

/** Clicks the CSV button and returns the file name and its text (no byte-order mark, \n line ends). */
export async function downloadCsv(page: Page, { sortRows = false } = {}) {
  const [download]: [Download, void] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("button.csv-download-btn").click(),
  ]);
  const text = readFileSync(await download.path(), "utf8")
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n");
  const [header, ...rows] = text.split("\n").filter((l) => l !== "");
  // the serial number column counts the rows in the order they came: it goes with the order, not the data
  const firstField = /^"[^"]*",/;
  const body = sortRows
    ? rows.map((r) => maskRunningNumber(r.replace(firstField, ""))).sort()
    : rows;
  const head = sortRows ? header.replace(firstField, "") : header;
  return `FILE: ${download.suggestedFilename()}\n${head}\n${body.join("\n")}\n`;
}
