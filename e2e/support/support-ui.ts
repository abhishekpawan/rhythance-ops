// Helpers for the Support journeys: the text of a Support screen as plain lines, with what is made at run time
// (dates and ticket numbers of tickets a journey creates) replaced, and a reader for the messages the test server
// recorded instead of sending.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** A date as the screens write it for the browser's locale (en-CA, Toronto), e.g. "Nov 10, 2026, 09:00 a.m.". */
const DATE =
  /[A-Z][a-z]{2,4}\.? \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?[ap]\.?\s?m\./gi;

/**
 * Everything the page shows, as one line per text block. The "time open" of the agent panel counts up to now, so it
 * is checked to look like `3h 20m` or `5m` and replaced. `runtime`: the ticket was made by the journey, so its
 * dates and number (which depend on what ran before) are replaced too.
 */
export async function screenText(page: Page, { runtime = false } = {}) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".loading-spinner")).toHaveCount(0);
  const open = page.locator(".support-agent-panel-header strong");
  if (await open.count()) {
    expect(await open.first().innerText()).toMatch(/^(\d+h )?\d+m$/);
    await open.first().evaluate((n) => (n.textContent = "<time open>"));
  }
  const raw = await page.locator(".page-container").innerText();
  let text = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (runtime)
    text = text.replace(DATE, "<date>").replace(/SUP-\d{4}/g, "SUP-NNNN");
  return text + "\n";
}

/** The support messages the test server recorded so far (subject like `[Test Portal] SUP-0006: title`). */
export function supportMails(): Array<{ to: string[]; subject: string }> {
  const file = process.env.E2E_OUTBOUND_LOG;
  if (!file) throw new Error("the test server's message log is not known");
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((e) => e.kind === "email" && /\] SUP-\d{4}: /.test(e.subject))
    .map((e) => ({ to: e.to, subject: e.subject }));
}

/** Waits until the server has recorded `n` more support messages than `before`, and returns them. */
export async function newMails(before: number, n: number) {
  await expect
    .poll(() => supportMails().length - before, { timeout: 10_000 })
    .toBe(n);
  return supportMails().slice(before);
}
