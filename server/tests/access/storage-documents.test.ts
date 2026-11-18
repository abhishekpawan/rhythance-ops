// SEC-1: files in storage. A jobseeker cannot list, download, replace or delete another jobseeker's files in
// jobseeker-documents, nor read signed consents or invoice files; with the anon key alone none of them can be
// listed or read; staff see every jobseeker's documents. Direct against the local Supabase with each user's token.
import { describe, expect, it } from "vitest";
import { FILES, JOBSEEKERS, jobseekerEmails, staffEmails, STAFF, storage, tokenFor } from "../support/api";

const staffRoles = Object.keys(STAFF) as Array<Extract<keyof typeof STAFF, string>>;
const SIN = FILES.sinDocument; // jobseeker-documents/<sin id>/id-document.pdf
const CASH = FILES.cashDocument; // jobseeker-documents/<cash id>/id-document.pdf

const listedNames = (r: { json: unknown }) => (Array.isArray(r.json) ? (r.json as Array<{ name: string }>).map((o) => o.name) : []);

describe("a jobseeker and another jobseeker's documents", () => {
  it("sees their own file and nobody else's folder", async () => {
    const token = await tokenFor(jobseekerEmails.cash);
    expect(listedNames(await storage.list("jobseeker-documents", `${JOBSEEKERS.cash.id}/`, token))).toEqual(["id-document.pdf"]);
    expect((await storage.download(CASH.bucket, CASH.name, token)).status).toBe(200);
    // the other jobseeker's folder lists as empty and its file does not download
    expect(listedNames(await storage.list("jobseeker-documents", `${JOBSEEKERS.sin.id}/`, token))).toEqual([]);
    expect((await storage.download(SIN.bucket, SIN.name, token)).status).toBeGreaterThanOrEqual(400);
    // the top level shows only their own folder
    expect(listedNames(await storage.list("jobseeker-documents", "", token))).toEqual([JOBSEEKERS.cash.id]);
  });

  it("cannot replace another jobseeker's file, and it is unchanged afterwards", async () => {
    const before = await storage.existsAsService(SIN.bucket, SIN.name);
    expect(before.exists).toBe(true);
    const token = await tokenFor(jobseekerEmails.cash);
    const replace = await storage.replace(SIN.bucket, SIN.name, "overwritten by someone else", token);
    expect(replace.status).toBeGreaterThanOrEqual(400);
    expect(await storage.existsAsService(SIN.bucket, SIN.name)).toEqual(before);
  });

  it("cannot upload into another jobseeker's folder", async () => {
    const token = await tokenFor(jobseekerEmails.cash);
    const r = await storage.upload("jobseeker-documents", `${JOBSEEKERS.sin.id}/planted.pdf`, "planted", token);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await storage.existsAsService("jobseeker-documents", `${JOBSEEKERS.sin.id}/planted.pdf`)).exists).toBe(false);
  });

  it("cannot delete another jobseeker's file, and it is still there afterwards", async () => {
    const before = await storage.existsAsService(SIN.bucket, SIN.name);
    const token = await tokenFor(jobseekerEmails.cash);
    const del = await storage.remove(SIN.bucket, SIN.name, token);
    // the storage API answers 200 with an empty list when the policy hides the object
    if (del.status === 200) expect(del.json).toEqual([]);
    expect(await storage.existsAsService(SIN.bucket, SIN.name)).toEqual(before);
  });

  it("can replace their own file", async () => {
    const token = await tokenFor(jobseekerEmails.cash);
    const r = await storage.replace(CASH.bucket, CASH.name, "%PDF-1.4 replaced by its owner", token);
    expect(r.status).toBe(200);
    expect((await storage.existsAsService(CASH.bucket, CASH.name)).content).toBe("%PDF-1.4 replaced by its owner");
  });
});

describe("consent originals", () => {
  it("stay readable without signing in: the public consent page needs them (034 keeps this on purpose)", async () => {
    const o = FILES.consentOriginal;
    expect((await storage.download(o.bucket, o.name)).status).toBe(200);
    expect((await storage.download(o.bucket, o.name, await tokenFor(jobseekerEmails.sin))).status).toBe(200);
  });
  it("but nobody without staff rights can write there", async () => {
    expect((await storage.replace("consent-documents", FILES.consentOriginal.name, "x", await tokenFor(jobseekerEmails.sin))).status).toBeGreaterThanOrEqual(400);
    expect((await storage.upload("consent-documents", "originals/planted.pdf", "x")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("signed consents (filled-consents/) and invoice files", () => {
  it.each([
    ["a jobseeker", () => tokenFor(jobseekerEmails.sin)],
    ["the anon key alone", async () => undefined],
  ])("%s cannot list or read them", async (_who, getToken) => {
    const token = await getToken();
    for (const file of [FILES.signedConsent, FILES.invoiceFile]) {
      const folder = file.name.slice(0, file.name.lastIndexOf("/") + 1);
      expect(listedNames(await storage.list(file.bucket, folder, token)), `${file.bucket} list`).toEqual([]);
      expect((await storage.download(file.bucket, file.name, token)).status, `${file.bucket} download`).toBeGreaterThanOrEqual(400);
    }
  });

  it("the jobseeker whose consent it is cannot read it either (staff only)", async () => {
    const token = await tokenFor(jobseekerEmails.sin);
    expect((await storage.download(FILES.signedConsent.bucket, FILES.signedConsent.name, token)).status).toBeGreaterThanOrEqual(400);
  });

  for (const role of staffRoles) {
    it(`${role} can read both`, async () => {
      const token = await tokenFor(staffEmails[role]);
      expect((await storage.download(FILES.signedConsent.bucket, FILES.signedConsent.name, token)).status).toBe(200);
      expect((await storage.download(FILES.invoiceFile.bucket, FILES.invoiceFile.name, token)).status).toBe(200);
    });
  }
});

describe("without signing in (the anon key alone)", () => {
  it("lists and reads nothing in any bucket", async () => {
    for (const [bucket, prefix] of [
      ["jobseeker-documents", ""],
      ["jobseeker-documents", `${JOBSEEKERS.sin.id}/`],
      ["consent-documents", "filled-consents/"],
      ["invoices", ""],
      ["support-attachments", ""],
      ["default-documents", ""],
    ] as const) {
      expect(listedNames(await storage.list(bucket, prefix)), `${bucket}/${prefix}`).toEqual([]);
    }
    for (const file of Object.values(FILES).filter((f) => f !== FILES.consentOriginal)) {
      expect((await storage.download(file.bucket, file.name)).status, file.name).toBeGreaterThanOrEqual(400);
    }
  });

  it("cannot write or delete either", async () => {
    expect((await storage.upload("jobseeker-documents", "anon/planted.pdf", "x")).status).toBeGreaterThanOrEqual(400);
    expect((await storage.replace(SIN.bucket, SIN.name, "x")).status).toBeGreaterThanOrEqual(400);
    const del = await storage.remove(SIN.bucket, SIN.name);
    if (del.status === 200) expect(del.json).toEqual([]);
    expect((await storage.existsAsService(SIN.bucket, SIN.name)).exists).toBe(true);
  });
});

describe("staff and jobseekers' documents", () => {
  for (const role of staffRoles) {
    it(`${role} lists and reads every jobseeker's documents`, async () => {
      const token = await tokenFor(staffEmails[role]);
      expect(listedNames(await storage.list("jobseeker-documents", `${JOBSEEKERS.sin.id}/`, token)), "sin").toEqual(["id-document.pdf"]);
      expect(listedNames(await storage.list("jobseeker-documents", `${JOBSEEKERS.cash.id}/`, token)), "cash").toEqual(["id-document.pdf"]);
      expect((await storage.download(SIN.bucket, SIN.name, token)).status).toBe(200);
      expect((await storage.download(CASH.bucket, CASH.name, token)).status).toBe(200);
      expect(listedNames(await storage.list("jobseeker-documents", "", token)).sort()).toEqual([JOBSEEKERS.cash.id, JOBSEEKERS.sin.id].sort());
    });
  }
});
