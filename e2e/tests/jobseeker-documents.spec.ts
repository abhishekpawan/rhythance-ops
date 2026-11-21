// DEV-3: the documents on the staff jobseeker profile, in English and French, as admin.
//   - a PNG or JPG upload shows as an image in the card and in the preview window (it used to show
//     "Failed to load preview" / "Failed to load PDF file"); a PDF keeps the PDF viewer;
//   - a document whose AI check failed shows "Not checked" with its reason, never a percentage or flags;
//   - a document with no answer yet shows "in progress"; a finished check shows its score;
//   - an inactive ai_validation row (a document that left the profile) never overrides the current answer.
// Borrows the seeded profile without documents and restores it afterwards (see below).
import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { requireLocal } from "../../server/tests/support/local-only.mjs";
import { localStack } from "../../server/tests/support/stack.mjs";
import { JOBSEEKERS, PROFILES } from "../../server/tests/seed/ids.mjs";
import { expect, test, type Language } from "../support/fixtures";

test.describe.configure({ mode: "serial" });

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** A valid one-page PDF (offsets worked out, so the PDF viewer opens it). */
function onePagePdf(): Buffer {
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>",
    "<</Length 0>>\nstream\n\nendstream",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const stack = (() => {
  requireLocal();
  return localStack();
})();

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${stack.apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: stack.serviceKey,
      Authorization: `Bearer ${stack.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers as Record<string, string>),
    },
  });

const upload = async (name: string, body: Buffer, type: string) => {
  const r = await rest(`/storage/v1/object/jobseeker-documents/${name}`, {
    method: "POST",
    body: new Uint8Array(body),
    headers: { "Content-Type": type },
  });
  expect(r.status, await r.text()).toBeLessThan(300);
};

// The seeded profile with no documents (Hana). The Reports journeys ask for "all job seekers" by id, so this
// journey must not add a profile: it gives Hana three documents and puts everything back when it is done.
const profileId = PROFILES.hybrid as string;
const dir = JOBSEEKERS.hybrid.id as string;
const doc = {
  png: randomUUID(), // finished check
  pdf: randomUUID(), // check failed: not checked
  jpg: randomUUID(), // no answer yet
};
const FILES_MADE = [
  `${dir}/ID/card.png`,
  `${dir}/ID/permit.pdf`,
  `${dir}/ID/licence.JPG`,
];

test.beforeAll(async () => {
  await upload(FILES_MADE[0], PNG, "image/png");
  await upload(FILES_MADE[1], onePagePdf(), "application/pdf");
  await upload(FILES_MADE[2], PNG, "image/png"); // a .JPG name on content the browser sniffs
  const documents = [
    {
      id: doc.png,
      documentType: "ID",
      documentPath: FILES_MADE[0],
      documentFileName: "card.png",
    },
    {
      id: doc.pdf,
      documentType: "Work permit",
      documentPath: FILES_MADE[1],
      documentFileName: "permit.pdf",
    },
    {
      id: doc.jpg,
      documentType: "Licence",
      documentPath: FILES_MADE[2],
      documentFileName: "licence.JPG",
    },
  ];
  const profile = await rest(`/rest/v1/jobseeker_profiles?id=eq.${profileId}`, {
    method: "PATCH",
    body: JSON.stringify({ documents }),
  });
  expect(profile.status, await profile.text()).toBeLessThan(300);

  const row = (
    document_id: string,
    ai_response: unknown,
    document_status = "active"
  ) => ({
    document_id,
    user_id: dir,
    ai_response,
    input_tokens: 0,
    output_tokens: 0,
    llm_model_name: "test",
    document_status,
  });
  const answers = await rest("/rest/v1/ai_validation", {
    method: "POST",
    body: JSON.stringify([
      row(doc.png, {
        document_authentication_percentage: 91,
        is_tampered: false,
        is_blurry: false,
        is_text_clear: true,
        is_resubmission_required: false,
        notes: "Looks fine.",
      }),
      // an old answer of a document that left the profile: it must not override the one above
      row(
        doc.png,
        {
          document_authentication_percentage: 3,
          is_tampered: true,
          is_blurry: true,
          is_text_clear: false,
          is_resubmission_required: true,
          notes: "OLD",
        },
        "inactive"
      ),
      row(doc.pdf, {
        check_status: "not_checked",
        not_checked_reason: "vendor_quota",
      }),
    ]),
  });
  expect(answers.status, await answers.text()).toBeLessThan(300);
});

test.afterAll(async () => {
  await rest(`/rest/v1/jobseeker_profiles?id=eq.${profileId}`, {
    method: "PATCH",
    body: JSON.stringify({ documents: [] }),
  });
  await rest(
    `/rest/v1/ai_validation?document_id=in.(${Object.values(doc).join(",")})`,
    { method: "DELETE" }
  );
  await rest("/storage/v1/object/jobseeker-documents", {
    method: "DELETE",
    body: JSON.stringify({ prefixes: FILES_MADE }),
  });
});

const REASON: Record<Language, string> = {
  en: "The AI provider is not accepting requests right now",
  fr: "Le fournisseur d'IA n'accepte pas de requêtes pour le moment",
};
const NOT_CHECKED: Record<Language, string> = {
  en: "Not checked",
  fr: "Non vérifié",
};

const card = (page: Page, fileName: string) =>
  page.locator(".document-item").filter({ hasText: fileName });

for (const language of ["en", "fr"] as const) {
  test.describe(`documents on the staff profile, in ${language}`, () => {
    test.use({ language, storageState: ".auth/admin.json" });

    test("images show as images, the PDF as a PDF, failed checks as not checked", async ({
      page,
    }) => {
      await page.goto(`/jobseekers/${profileId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator(".document-item")).toHaveCount(3);
      await page.waitForLoadState("networkidle");

      // no preview error anywhere on the page
      await expect(
        page.getByText(/Failed to load|Échec du chargement/)
      ).toHaveCount(0);

      // the PNG and the .JPG: a real <img> that decoded
      for (const name of ["card.png", "licence.JPG"]) {
        const img = card(page, name).locator(
          "img.image-document-thumbnail-image"
        );
        await expect(img).toBeVisible();
        expect(
          await img.evaluate((i: HTMLImageElement) => i.naturalWidth)
        ).toBeGreaterThan(0);
      }
      // the PDF: the first page drawn in a canvas by the PDF viewer
      await expect(card(page, "permit.pdf").locator("canvas")).toBeVisible();

      // the finished check keeps its score; the inactive row did not override it
      const finished = card(page, "card.png");
      await expect(finished.locator(".score-value")).toHaveText("91%");
      await expect(finished).not.toContainText("OLD");

      // the failed check: its reason, no percentage and no flags
      const failed = card(page, "permit.pdf");
      await expect(failed.locator(".validation-not-checked")).toContainText(
        NOT_CHECKED[language]
      );
      await expect(failed.locator(".validation-not-checked")).toContainText(
        REASON[language]
      );
      await expect(
        failed.locator(".score-value, .validation-status-item")
      ).toHaveCount(0);

      // no answer yet
      await expect(
        card(page, "licence.JPG").locator(".validation-progress-title")
      ).toBeVisible();
      await expect(
        card(page, "licence.JPG").locator(".validation-not-checked")
      ).toHaveCount(0);

      await page.screenshot({
        path: `test-results/jobseeker-documents-${language}.png`,
        fullPage: true,
      });
    });

    test("the preview window opens an image as an image and a PDF as a PDF", async ({
      page,
    }) => {
      await page.goto(`/jobseekers/${profileId}`);
      await page.waitForLoadState("networkidle");

      await card(page, "card.png")
        .locator(".document-actions button")
        .first()
        .click();
      const modal = page.locator(".pdf-modal-content");
      const img = modal.locator("img");
      await expect(img).toBeVisible();
      expect(
        await img.evaluate((i: HTMLImageElement) => i.naturalWidth)
      ).toBeGreaterThan(0);
      await expect(modal.getByText(/Failed to load|Échec/)).toHaveCount(0);
      await modal.locator(".pdf-modal-close-btn").click();
      await expect(modal).toHaveCount(0);

      await card(page, "permit.pdf")
        .locator(".document-actions button")
        .first()
        .click();
      await expect(modal.locator("canvas")).toBeVisible();
      await expect(modal.locator("img")).toHaveCount(0);
      await expect(modal.getByText(/Failed to load|Échec/)).toHaveCount(0);
      await modal.locator(".pdf-modal-close-btn").click();

      // and an image again after a PDF
      await card(page, "licence.JPG")
        .locator(".document-actions button")
        .first()
        .click();
      await expect(modal.locator("img")).toBeVisible();
      await expect(modal.locator("canvas")).toHaveCount(0);
    });
  });
}
