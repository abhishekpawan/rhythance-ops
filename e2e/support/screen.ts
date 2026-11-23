// Helper for the journeys of the admin pages, the calendar, the email previews and the training page: the text of a
// screen as plain lines, with the dates the pages write at run time replaced.
import { expect, type Page } from "@playwright/test";

/** A date as the screens write it for the browser's locale (en-CA, Toronto), e.g. "Nov 10, 2026, 09:00 a.m.". */
const DATE =
  /[A-Z][a-z]{2,4}\.? \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?[ap]\.?\s?m\./gi;
/** The same in French (fr-CA), e.g. "10 nov. 2026, 09 h 00". */
const DATE_FR = /\d{1,2} [a-zéû]{3,5}\.? \d{4}, \d{1,2} h \d{2}/gi;

/**
 * Everything inside `root` (a CSS selector) as one line per text block. `masked` also replaces the dates of "last
 * changed" lines, which carry the moment the seed or an earlier journey wrote a row.
 */
export async function screenText(
  page: Page,
  root: string,
  { maskDates = true }: { maskDates?: boolean } = {}
) {
  // No waitForLoadState("networkidle") here: a screen that holds a srcdoc iframe (the email preview) never reaches it
  // when the machine is slow, however quiet the network is. Each journey waits for the state its screen shows
  // (cards, rows, the preview itself) before it calls this; this waits for the screen and the loader.
  await expect(page.locator(root).first()).toBeVisible();
  await expect(page.locator(".loading-spinner")).toHaveCount(0);
  // the toast ("saved", "added") stays for a few seconds and then goes: it is not part of the page, and whether it is
  // still there depends on how fast the run is. A journey waits for the state a save leaves behind, never for the toast.
  await page
    .locator(`${root} .toast, .toast`)
    .evaluateAll((all) =>
      all.forEach((el) => ((el as HTMLElement).style.display = "none"))
    );
  const raw = await page.locator(root).first().innerText();
  let text = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (maskDates) text = text.replace(DATE, "<date>").replace(DATE_FR, "<date>");
  return text + "\n";
}
