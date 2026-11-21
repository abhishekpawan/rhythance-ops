// The two picture windows of Support (the thread's attachment preview and the new-ticket file preview), built on
// components/Modal.tsx: the Escape key closes them, and the focus goes back to the thumbnail that opened them, even
// when the person clicked inside the window first (the click takes the focus away from the thumbnail; before the
// shared window, nothing gave it back).
//
// Nothing is made on the server: the new-ticket journey only picks a file (it is stored, no ticket is raised), and
// the thread journey asks the server for ticket 1 as usual and only changes the answer in the browser so that its
// two seeded files (PDFs) look like pictures and have a picture to show.
import { type Page } from "@playwright/test";
import { SUPPORT } from "../../server/tests/seed/ids.mjs";
import { expect, test, type Language } from "../support/fixtures";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAATklEQVR4nO3PUQkAIBTAwBfHiEY0liH8OITBAtxm7fN1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjx2AQvZQKZEMqCeAAAAAElFTkSuQmCC";
const PNG = Buffer.from(PNG_BASE64, "base64");

async function open(page: Page, path: string, language: Language) {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await page.waitForLoadState("networkidle");
}

/** Open the window with a click, click inside it (the focus leaves the thumbnail), press Escape. */
async function checkWindow(page: Page, thumbnail: ReturnType<Page["locator"]>) {
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toHaveCount(0);

  await thumbnail.click();
  await expect(dialog).toHaveCount(1);
  await expect(dialog.locator("img")).toBeVisible();
  // a click on the picture is a click inside the window: it stays open and the focus is no longer on the thumbnail
  await dialog.locator("img").click();
  await expect(dialog).toHaveCount(1);
  await expect(thumbnail).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(thumbnail).toBeFocused();

  // from the keyboard: Enter on the thumbnail opens it, the close button closes it, the focus comes back
  await thumbnail.press("Enter");
  await expect(dialog).toHaveCount(1);
  await dialog.locator("button[aria-label]").last().click();
  await expect(dialog).toHaveCount(0);
  await expect(thumbnail).toBeFocused();

  // a click on the dark backdrop closes it too
  await thumbnail.click();
  await expect(dialog).toHaveCount(1);
  const box = (await dialog.boundingBox())!;
  // the bottom right corner: the side menu lies over the top left one
  await dialog.click({ position: { x: box.width - 6, y: box.height - 6 } });
  await expect(dialog).toHaveCount(0);
  await expect(thumbnail).toBeFocused();
}

for (const language of ["en", "fr"] as const) {
  test.describe(`picture windows, in ${language}`, () => {
    test.use({ language });

    test.describe("the thread of a ticket", () => {
      test.use({ storageState: ".auth/recruiter.json" });

      test("the preview of an attachment: Escape, the close button, the backdrop, and the focus coming back", async ({
        page,
      }) => {
        // ticket 1 as its owner, with its first file turned into a picture in the answer the browser reads
        await page.route(
          `**/api/support/tickets/${SUPPORT.recruiterBug.id}`,
          async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            json.attachments = json.attachments.map(
              (a: { fileName: string }) => ({
                ...a,
                mimeType: "image/png",
                fileName: a.fileName.replace(/\.pdf$/, ".png"),
              })
            );
            await route.fulfill({ response, json });
          }
        );
        await page.route("**/api/support/attachments/*/url", (route) =>
          route.fulfill({
            json: {
              success: true,
              url: `data:image/png;base64,${PNG_BASE64}`,
            },
          })
        );
        await open(page, `/support/${SUPPORT.recruiterBug.id}`, language);
        const thumbnail = page.locator(".support-file-thumb-wrap").first();
        await expect(thumbnail.locator("img")).toBeVisible();
        await checkWindow(page, thumbnail);
      });
    });

    test.describe("the new-ticket form", () => {
      test.use({ storageState: ".auth/sales.json" });

      test("the preview of a picked file: Escape, the close button, the backdrop, and the focus coming back", async ({
        page,
      }) => {
        await open(page, "/support/new", language);
        await page.locator('input[type="file"]').first().setInputFiles({
          name: "pic.png",
          mimeType: "image/png",
          buffer: PNG,
        });
        await expect(page.locator(".support-file-item")).toHaveCount(1);
        await page.waitForLoadState("networkidle");
        const thumbnail = page.locator(".support-file-thumb-wrap").first();
        await expect(thumbnail.locator("img")).toBeVisible();
        await checkWindow(page, thumbnail);
      });
    });
  });
}
