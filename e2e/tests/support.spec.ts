// The Support screens (ticket list, one ticket, raise a ticket) through the real browser, in English and in French.
//
// First everything that only reads, on the five seeded tickets (server/tests/seed/data.sql, ids in ids.mjs), as the
// accounts that may see them differently: admin (a shared viewer), the recruiter who owns ticket 1, the support agent
// (super admin), a bookkeeper who owns ticket 2 and may not see ticket 1, and sales who owns the closed ticket 4.
// Then one ticket's whole life as the person who raises it and the agent: raise it with a file, reply, the agent's
// internal note and status change, the owner says it is not fixed, the agent resolves it again, the owner confirms.
//
// What is pinned: the screen as plain text (tests/__snapshots__/support/), the request body of every call that
// changes something (worked out from the screens' code, never copied from a run), and the messages the server
// recorded. The tests run one after the other in this file: the list screens read the five seeded tickets, so no
// ticket may be made before they have been read, and the second half builds on the ticket the first of it made.
import { type Page, type Request } from "@playwright/test";
import {
  STAFF,
  SUPPORT,
  SUPPORT_ATTACHMENTS,
} from "../../server/tests/seed/ids.mjs";
import { expect, test, type Language } from "../support/fixtures";
import { staff } from "../support/accounts";
import { newMails, screenText, supportMails } from "../support/support-ui";

test.describe.configure({ mode: "serial" });

const state = (role: string) => `.auth/${role}.json`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const snap = (name: string, language: Language) => [
  "support",
  `${name}.${language}.txt`,
];

/** Opens a path and waits until the page has stopped asking the server for things. */
async function open(page: Page, path: string, language: Language) {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await page.waitForLoadState("networkidle");
}

const isList = (query: string) => (r: Request) =>
  r.method() === "GET" &&
  new URL(r.url()).pathname === "/api/support/tickets" &&
  new URL(r.url()).search === query;

for (const language of ["en", "fr"] as const) {
  test.describe(`reading, in ${language}`, () => {
    test.use({ language });

    test.describe("admin", () => {
      test.use({ storageState: state("admin") });

      test("the list: my tickets, all tickets, one status", async ({
        page,
      }) => {
        const mine = page.waitForRequest(isList("?scope=mine&page=1&limit=20"));
        await open(page, "/support", language);
        await mine;
        await expect(page.locator("tbody tr")).toHaveCount(1); // ticket 3 is the admin's own
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-admin-mine", language)
        );

        const all = page.waitForRequest(isList("?scope=all&page=1&limit=20"));
        await page.locator(".support-scope-btn").nth(1).click();
        await all;
        await expect(page.locator("tbody tr")).toHaveCount(5);
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-admin-all", language)
        );

        const resolved = page.waitForRequest(
          isList("?scope=all&status=resolved&page=1&limit=20")
        );
        await page.locator("#support-status-filter").selectOption("resolved");
        await resolved;
        await expect(page.locator("tbody tr")).toHaveCount(1);
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-admin-all-resolved", language)
        );
      });

      test("another person's ticket: read only, with the file but not the internal note", async ({
        page,
      }) => {
        await open(page, `/support/${SUPPORT.recruiterBug.id}`, language);
        await expect(page.locator(".support-message-bubble")).toHaveCount(2);
        await expect(page.locator(".support-reply-card textarea")).toHaveCount(
          0
        );
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-1-as-admin", language)
        );
      });
    });

    test.describe("recruiter (owns ticket 1)", () => {
      test.use({ storageState: state("recruiter") });

      test("the list and the ticket as its owner, and the file downloads", async ({
        page,
        context,
      }) => {
        await open(page, "/support", language);
        await expect(page.locator("tbody tr")).toHaveCount(1);
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-recruiter-mine", language)
        );

        await page.locator("tbody tr").click();
        await expect(page).toHaveURL(
          new RegExp(`/support/${SUPPORT.recruiterBug.id}$`)
        );
        await expect(page.locator(".support-message-bubble")).toHaveCount(2);
        await expect(page.locator(".support-reply-card textarea")).toHaveCount(
          1
        );
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-1-as-owner", language)
        );

        // the download button asks the server for a link and opens it in a new tab
        const link = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
            `/api/support/attachments/${SUPPORT_ATTACHMENTS.onDescription.id}/url`
        );
        const popup = context.waitForEvent("page");
        await page.locator(".support-file-actions button").last().click();
        const answer = await link;
        expect(answer.status()).toBe(200);
        // the tab is opened (noopener) on the signed link of the file's own place in the private bucket
        const url = new URL((await answer.json()).url);
        expect(url.pathname).toBe(
          `/storage/v1/object/sign/support-attachments/${SUPPORT.recruiterBug.id}/screenshot-error.pdf`
        );
        const tab = await popup;
        await tab.close();
      });
    });

    test.describe("the agent (super admin)", () => {
      test.use({ storageState: state("superadmin") });

      test("the list is empty for its own tickets; ticket 1 with the internal note and the panel", async ({
        page,
      }) => {
        await open(page, "/support", language);
        await expect(page.locator("tbody tr")).toHaveCount(0);
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-agent-mine-empty", language)
        );

        await open(page, `/support/${SUPPORT.recruiterBug.id}`, language);
        await expect(page.locator(".support-message-bubble")).toHaveCount(3);
        await expect(page.locator(".support-internal-badge")).toHaveCount(1);
        await expect(page.locator(".support-agent-panel")).toBeVisible();
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-1-as-agent", language)
        );
      });
    });

    test.describe("bookkeeper (owns ticket 2, a resolved one)", () => {
      test.use({ storageState: state("bookkeeper") });

      test("its own list without the scope switch, its resolved ticket, and a ticket that is not its own", async ({
        page,
      }) => {
        const mine = page.waitForRequest(isList("?scope=mine&page=1&limit=20"));
        await open(page, "/support", language);
        await mine;
        await expect(page.locator(".support-scope-btn")).toHaveCount(0);
        await expect(page.locator("tbody tr")).toHaveCount(1);
        expect(await screenText(page)).toMatchSnapshot(
          snap("list-bookkeeper", language)
        );

        await open(page, `/support/${SUPPORT.bookkeeperQuestion.id}`, language);
        await expect(page.locator(".support-resolution-card")).toBeVisible();
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-2-as-owner-resolved", language)
        );

        // the server answers 404 for another person's ticket; the screen says so and the person stays signed in
        await open(page, `/support/${SUPPORT.recruiterBug.id}`, language);
        await expect(page.locator(".support-not-found-btn")).toBeVisible();
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-not-found", language)
        );
        await expect(page).toHaveURL(/\/support\//);
      });
    });

    test.describe("sales (owns ticket 4, a closed one)", () => {
      test.use({ storageState: state("sales") });

      test("a closed ticket can be reopened for 14 days", async ({ page }) => {
        await open(page, `/support/${SUPPORT.salesFeature.id}`, language);
        await expect(page.locator(".support-closed-notice")).toBeVisible();
        expect(await screenText(page)).toMatchSnapshot(
          snap("ticket-4-as-owner-closed", language)
        );
      });
    });
  });
}

for (const language of ["en", "fr"] as const) {
  test.describe(`one ticket's life, in ${language}`, () => {
    test.use({ language });
    let ticketPath = "";
    let ticketTitle = "";

    test.describe("the owner raises a ticket", () => {
      test.use({ storageState: state("recruiter") });

      test("with a file; the support address is told", async ({ page }) => {
        const mailsBefore = supportMails().length;
        const description = `The invoice list is blank in ${language}\nIt shows nothing after I pick a client.`;
        ticketTitle = description.split("\n")[0];
        await open(page, "/support/new", language);

        // type: the three cards; "feature" is the third
        await page.locator(".support-choice-card").nth(2).click();
        await page.locator("#support-description").fill(description);
        const signed = page.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/support/attachments/sign"
        );
        await page
          .locator('input[type="file"]')
          .first()
          .setInputFiles({
            name: "note.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("what I saw\n"),
          });
        expect((await signed).status()).toBe(200);
        await expect(page.locator(".support-file-item")).toHaveCount(1);
        await page.waitForLoadState("networkidle"); // the file itself goes to storage after the link is signed
        await page.locator(".support-urgency-card").nth(1).click(); // annoying
        await expect(page.locator('form button[type="submit"]')).toBeEnabled();

        const sent = page.waitForRequest(
          (r) =>
            r.method() === "POST" &&
            new URL(r.url()).pathname === "/api/support/tickets"
        );
        await page.locator('form button[type="submit"]').click();
        const body = (await sent).postDataJSON();

        // worked out from SupportNew.tsx and lib/supportContext.ts
        expect(body).toEqual({
          type: "feature",
          description,
          urgency: "annoying",
          locale: language,
          idempotencyKey: expect.stringMatching(UUID),
          context: expect.objectContaining({
            route: "/support/new",
            language,
            browser: expect.stringMatching(/^Chrome \d+$/),
            // the OS of the machine the journeys run on (lib/supportContext.ts reads it from the user agent)
            os: process.platform === "darwin" ? "macOS" : "Linux",
            consoleErrors: expect.any(Array),
            failedRequests: expect.any(Array),
          }),
          attachments: [
            {
              path: expect.stringMatching(
                new RegExp(
                  `^pending/${STAFF.recruiter.id}/[0-9a-f-]{36}-note\\.txt$`
                )
              ),
              fileName: "note.txt",
              mimeType: "text/plain",
              sizeBytes: 11,
            },
          ],
        });

        await expect(page).toHaveURL(/\/support\/[0-9a-f-]{36}$/);
        ticketPath = new URL(page.url()).pathname;
        await expect(page.locator(".support-message-bubble")).toHaveCount(1);
        await expect(page.locator(".support-file-item")).toHaveCount(1);
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("created-ticket", language)
        );

        const mails = await newMails(mailsBefore, 1);
        expect(mails[0].to).toEqual(["support@example.test"]);
        expect(mails[0].subject).toMatch(
          new RegExp(`^\\[Test Portal\\] SUP-\\d{4}: ${ticketTitle}$`)
        );
      });

      test("replies", async ({ page }) => {
        const mailsBefore = supportMails().length;
        await open(page, ticketPath, language);
        await page
          .locator(".support-reply-card textarea")
          .fill("It is the invoice list, not the timesheet.");
        const sent = page.waitForRequest(
          (r) =>
            r.method() === "POST" &&
            r
              .url()
              .endsWith(
                `${ticketPath.replace("/support", "/api/support/tickets")}/messages`
              )
        );
        await page.locator(".support-reply-card button[type='submit']").click();
        // SupportTicket.tsx: the owner is not an agent, so isInternal is always false
        expect((await sent).postDataJSON()).toEqual({
          body: "It is the invoice list, not the timesheet.",
          isInternal: false,
        });
        await expect(page.locator(".support-message-bubble")).toHaveCount(2);
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("after-reply", language)
        );
        expect((await newMails(mailsBefore, 1))[0].to).toEqual([
          "support@example.test",
        ]);
      });
    });

    test.describe("the agent", () => {
      test.use({ storageState: state("superadmin") });

      test("writes an internal note, then resolves the ticket", async ({
        page,
      }) => {
        const mailsBefore = supportMails().length;
        await open(page, ticketPath, language);
        const messages = `${ticketPath.replace("/support", "/api/support/tickets")}/messages`;

        await page
          .locator(".support-reply-card textarea")
          .fill("Internal: looks like the client filter.");
        await page
          .locator(".support-reply-card input[type='checkbox']")
          .check();
        const note = page.waitForRequest(
          (r) => r.method() === "POST" && r.url().endsWith(messages)
        );
        await page.locator(".support-reply-card button[type='submit']").click();
        expect((await note).postDataJSON()).toEqual({
          body: "Internal: looks like the client filter.",
          isInternal: true,
        });
        await expect(page.locator(".support-internal-badge")).toHaveCount(1);

        await page.locator("#agent-status-select").selectOption("resolved");
        await page.locator("#agent-priority-select").selectOption("p1");
        await page.locator("#agent-effort-hours").fill("1.5");
        const ticketApi = ticketPath.replace(
          "/support",
          "/api/support/tickets"
        );
        const saved = page.waitForRequest(
          (r) => r.method() === "PATCH" && r.url().endsWith(ticketApi)
        );
        // after the save the screen asks for the ticket again; read it only once that answer is in
        const reloaded = page.waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            new URL(r.url()).pathname === ticketApi
        );
        await page
          .locator(".support-agent-panel button.button.primary")
          .click();
        expect((await saved).postDataJSON()).toEqual({
          status: "resolved",
          priority: "p1",
          effortHours: 1.5,
        });
        await reloaded;
        await page.waitForLoadState("networkidle");
        await expect(page.locator(".support-status-history-item")).toHaveCount(
          2
        );
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("agent-after-resolve", language)
        );
        // the internal note tells nobody; "resolved" tells the requester
        const mails = await newMails(mailsBefore, 1);
        expect(mails[0].to).toEqual([staff.recruiter.email]);
      });
    });

    test.describe("the owner says it is not fixed", () => {
      test.use({ storageState: state("recruiter") });

      test("the reason box, then the reopen request", async ({ page }) => {
        const mailsBefore = supportMails().length;
        await open(page, ticketPath, language);
        // the internal note is not on the owner's screen
        await expect(page.locator(".support-internal-badge")).toHaveCount(0);
        await expect(page.locator(".support-resolution-card")).toBeVisible();
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("owner-sees-resolved", language)
        );

        const api = ticketPath.replace("/support", "/api/support/tickets");
        await page.locator(".support-resolution-actions button").nth(1).click();
        await page.locator("#reopen-reason").fill("The list is still blank.");
        const reopen = page.waitForRequest(
          (r) => r.method() === "POST" && r.url().endsWith(`${api}/reopen`)
        );
        await page
          .locator(".support-resolution-card .button.primary")
          .last()
          .click();
        expect((await reopen).postDataJSON()).toEqual({
          body: "The list is still blank.",
        });
        await expect(page.locator(".support-resolution-card")).toHaveCount(0);
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("after-not-fixed", language)
        );
        // the owner reopening tells the support address
        expect((await newMails(mailsBefore, 1))[0].to).toEqual([
          "support@example.test",
        ]);
      });
    });

    test.describe("the agent resolves it again", () => {
      test.use({ storageState: state("superadmin") });

      test("through the panel", async ({ page }) => {
        const mailsBefore = supportMails().length;
        const api = ticketPath.replace("/support", "/api/support/tickets");
        await open(page, ticketPath, language);
        await page.locator("#agent-status-select").selectOption("resolved");
        const patched = page.waitForRequest(
          (r) => r.method() === "PATCH" && r.url().endsWith(api)
        );
        await page
          .locator(".support-agent-panel button.button.primary")
          .click();
        // priority and hours were set by the first save and the panel loads them back
        expect((await patched).postDataJSON()).toEqual({
          status: "resolved",
          priority: "p1",
          effortHours: 1.5,
        });
        await expect(page.locator("#agent-status-select")).toHaveValue(
          "resolved"
        );
        expect((await newMails(mailsBefore, 1))[0].to).toEqual([
          staff.recruiter.email,
        ]);
      });
    });

    test.describe("the owner confirms", () => {
      test.use({ storageState: state("recruiter") });

      test("it is fixed; the ticket is closed and can be reopened for 14 days", async ({
        page,
      }) => {
        const mailsBefore = supportMails().length;
        const api = ticketPath.replace("/support", "/api/support/tickets");
        await open(page, ticketPath, language);
        const confirm = page.waitForRequest(
          (r) => r.method() === "POST" && r.url().endsWith(`${api}/confirm`)
        );
        await page
          .locator(".support-resolution-actions button")
          .first()
          .click();
        expect((await confirm).postData()).toBeNull();
        await expect(page.locator(".support-closed-notice")).toBeVisible();
        expect(await screenText(page, { runtime: true })).toMatchSnapshot(
          snap("after-confirm", language)
        );
        // confirming tells nobody
        expect(supportMails().length).toBe(mailsBefore);
      });
    });
  });
}
