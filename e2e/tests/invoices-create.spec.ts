// Invoices, creating one (/invoice-management/create) as the admin, in English and in French (R-5, gate d).
//
// Money is worked out in the browser (`calculateLineItemTotals` in InvoiceManagement.tsx) and the server stores what it
// is sent, so each case does what a person does (chooses a client, loads the timesheets of a week or types a line,
// chooses the sales tax) and pins four things: the request body the browser sends to save (written here by hand, every
// number worked out on paper, compared number by number), the lines and totals the screen shows (as text), the PDF the
// browser made and uploaded (read back from storage as content: pages, size, every text item at 0.1 pt), and the row
// the database holds after. The tax cases are the seed's four clients: Ontario HST 13%, Quebec GST 5% + QST 9.975%,
// British Columbia GST 5%, Alberta zero rated in USD.
//
// The tests run one after the other (they write invoices, and the list journeys read them): every invoice and stored
// file is removed after each test (`sweepInvoices`).
import { expect, test as base } from "../support/fixtures";
import { FIXED_NOW } from "../../server/tests/seed/ids.mjs";
import {
  TAX,
  answered,
  bodyOf,
  invoiceById,
  invoiceMails,
  lineGroups,
  loadTimesheets,
  pdfContent,
  pickIn,
  sameMoney,
  savedInvoices,
  setTax,
  startInvoice,
  storedObject,
  sweepInvoices,
  totalsText,
  typeLine,
  watchInvoiceCalls,
} from "../support/invoice-screens";
import {
  CLIENTS,
  PEOPLE,
  POSITIONS,
  FIXED_MS,
  MESSAGE_ON_INVOICE,
  TERMS_ON_INVOICE,
  createBody,
  createLine,
  type ClientKey,
  type Line,
  type Totals,
} from "../support/invoice-expected";

base.describe.configure({ mode: "serial" });

type Case = {
  name: string;
  client: ClientKey;
  find: RegExp;
  /** timesheets of this range are loaded (none: the lines are typed) */
  range?: [string, string];
  /** the number of lines the page shows after loading */
  lines?: number;
  /** the sales tax chosen on each line, in order (a line left out keeps the page's default) */
  taxes?: string[];
  /** typed lines */
  typed?: Array<{
    position?: RegExp;
    person?: RegExp;
    desc?: string;
    hours: string;
    rate: string;
    tax?: string;
  }>;
  expect: Line[];
  totals: Totals;
  /** what the table keeps (two decimals) when a total has more: worked out by hand */
  stored?: { subtotal: number; tax: number; grand: number };
};

const SAM = PEOPLE.sam;
const CASES: Case[] = [
  {
    // four lines of the first week of November: 40 h x 35 = 1,400, 1,400, 700, 700 = 4,200; HST 13% = 546; total 4,746
    name: "Ontario HST, four timesheet lines",
    client: "northwind",
    find: /Northwind/,
    range: ["2026-11-01", "2026-11-07"],
    lines: 4,
    expect: [
      {
        reg: 40,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 1400,
        jobPay: 800,
        desc: "Work period: Nov 1 – Nov 7, 2026",
        tax: TAX.ON,
        person: PEOPLE.sam,
        position: POSITIONS.warehouse,
      },
      {
        reg: 40,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 1400,
        jobPay: 800,
        desc: "Work period: Nov 1 – Nov 7, 2026",
        tax: TAX.ON,
        person: PEOPLE.casey,
        position: POSITIONS.warehouse,
      },
      {
        reg: 20,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 700,
        jobPay: 400,
        desc: "Work period: Nov 1 – Nov 7, 2026",
        tax: TAX.ON,
        person: PEOPLE.hana,
        position: POSITIONS.warehouse,
      },
      {
        reg: 20,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 700,
        jobPay: 400,
        desc: "Work period: Nov 1 – Nov 7, 2026",
        tax: TAX.ON,
        person: PEOPLE.hana,
        position: POSITIONS.warehouse,
      },
    ],
    totals: {
      subtotal: 4200,
      hst: 546,
      gst: 0,
      qst: 0,
      tax: 546,
      grand: 4746,
      hours: 120,
    },
  },
  {
    // 50 h on the overtime position: 40 x 35 + 10 x 52.50 = 1,925; HST 13% = 250.25; total 2,175.25
    name: "Ontario HST, an overtime week",
    client: "northwind",
    find: /Northwind/,
    range: ["2026-11-08", "2026-11-14"],
    lines: 1,
    expect: [
      {
        reg: 40,
        ot: 10,
        rate: 35,
        otRate: 52.5,
        pay: 20,
        otPay: 30,
        bill: 1925,
        jobPay: 1100,
        desc: "Work period: Nov 8 – Nov 14, 2026",
        tax: TAX.ON,
        person: PEOPLE.sam,
        position: POSITIONS.forklift,
        otEnabled: true,
      },
    ],
    totals: {
      subtotal: 1925,
      hst: 250.25,
      gst: 0,
      qst: 0,
      tax: 250.25,
      grand: 2175.25,
      hours: 50,
    },
  },
  {
    // Quebec, 40 h x 35 = 1,400: GST 5% = 70, QST 9.975% = 139.65, tax 209.65, total 1,609.65 (premium pay 2.5 on 20)
    name: "Quebec GST and QST",
    client: "quebec",
    find: /Quebec/,
    range: ["2026-11-08", "2026-11-14"],
    lines: 1,
    taxes: [TAX.QC],
    expect: [
      {
        reg: 40,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 22.5,
        bill: 1400,
        jobPay: 900,
        desc: "Work period: Nov 8 – Nov 14, 2026",
        tax: TAX.QC,
        person: PEOPLE.corey,
        position: POSITIONS.driver,
      },
    ],
    totals: {
      subtotal: 1400,
      hst: 0,
      gst: 70,
      qst: 139.65,
      tax: 209.65,
      grand: 1609.65,
      hours: 40,
    },
  },
  {
    // British Columbia: 30 h and 10 h at 35 = 1,050 + 350, and a bonus of 50 (1 h x 50) = 1,450; GST 5% = 72.50; total 1,522.50
    name: "British Columbia GST, two lines and a bonus",
    client: "pacific",
    find: /Pacific/,
    range: ["2026-10-25", "2026-10-31"],
    lines: 3,
    taxes: [TAX.BC, TAX.BC, TAX.BC],
    expect: [
      {
        reg: 30,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 1050,
        jobPay: 600,
        desc: "Work period: Oct 25 – Oct 31, 2026",
        tax: TAX.BC,
        person: PEOPLE.ely,
        position: POSITIONS.loader,
      },
      {
        reg: 10,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 350,
        jobPay: 200,
        desc: "Work period: Oct 25 – Oct 31, 2026",
        tax: TAX.BC,
        person: PEOPLE.ely,
        position: POSITIONS.loader,
      },
      {
        reg: 1,
        ot: 0,
        rate: 50,
        otRate: 50,
        pay: 0,
        otPay: 0,
        bill: 50,
        jobPay: 0,
        desc: "Bonus",
        tax: TAX.BC,
        person: PEOPLE.ely,
        position: POSITIONS.loader,
      },
    ],
    totals: {
      subtotal: 1450,
      hst: 0,
      gst: 72.5,
      qst: 0,
      tax: 72.5,
      grand: 1522.5,
      hours: 41,
    },
  },
  {
    // Alberta, USD, zero rated: 40 h x 35 = 1,400, no tax, total 1,400; Net 45 from 17 November is 1 January
    name: "Alberta zero rated in USD",
    client: "prairie",
    find: /Prairie/,
    range: ["2026-09-20", "2026-09-26"],
    lines: 1,
    taxes: [TAX.ZERO],
    expect: [
      {
        reg: 40,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 20,
        otPay: 20,
        bill: 1400,
        jobPay: 800,
        desc: "Work period: Sep 20 – Sep 26, 2026",
        tax: TAX.ZERO,
        person: PEOPLE.sam,
        position: POSITIONS.lineCook,
      },
    ],
    totals: {
      subtotal: 1400,
      hst: 0,
      gst: 0,
      qst: 0,
      tax: 0,
      grand: 1400,
      hours: 40,
    },
  },
  {
    // typed: 45 h on the overtime position = 40 x 35 + 5 x 52.50 = 1,662.50; HST 13% = 216.125; total 1,878.625
    name: "typed line, overtime position, Ontario HST",
    client: "northwind",
    find: /Northwind/,
    typed: [
      {
        position: /Forklift/,
        person: /Sam/,
        desc: "Typed by hand",
        hours: "45",
        rate: "35",
      },
    ],
    expect: [
      {
        reg: 40,
        ot: 5,
        rate: 35,
        otRate: 52.5,
        pay: 20,
        otPay: 30,
        bill: 1662.5,
        jobPay: 950,
        desc: "Typed by hand",
        tax: TAX.ON,
        person: PEOPLE.sam,
        position: POSITIONS.forklift,
        otEnabled: true,
      },
    ],
    totals: {
      subtotal: 1662.5,
      hst: 216.125,
      gst: 0,
      qst: 0,
      tax: 216.125,
      grand: 1878.625,
      hours: 45,
    },
    stored: { subtotal: 1662.5, tax: 216.13, grand: 1878.63 },
  },
  {
    // typed, no position: 0.5 h x 22.55 = 11.275; HST 13% = 1.46575; total 12.74075 (the page does not round)
    name: "typed line with part of a cent",
    client: "northwind",
    find: /Northwind/,
    typed: [{ desc: "Odd cent", hours: "0.5", rate: "22.55" }],
    expect: [
      {
        reg: 0.5,
        ot: 0,
        rate: 22.55,
        otRate: 22.55,
        pay: 0,
        otPay: 0,
        bill: 11.275,
        jobPay: 0,
        desc: "Odd cent",
        tax: TAX.ON,
      },
    ],
    totals: {
      subtotal: 11.275,
      hst: 1.46575,
      gst: 0,
      qst: 0,
      tax: 1.46575,
      grand: 12.74075,
      hours: 0.5,
    },
    // the parts the table keeps (11.28 + 1.47) add up to 12.75, the total it keeps is 12.74 (a cent apart: inbox row)
    stored: { subtotal: 11.28, tax: 1.47, grand: 12.74 },
  },
  {
    // typed: 40 h x 35 = 1,400 with HST 182, and a zero-rated line of 1 h at -50 (a discount): subtotal 1,350, tax 182, total 1,532
    name: "typed lines with a discount",
    client: "northwind",
    find: /Northwind/,
    typed: [
      { desc: "Warehouse", hours: "40", rate: "35" },
      { desc: "Discount", hours: "1", rate: "-50", tax: TAX.ZERO },
    ],
    expect: [
      {
        reg: 40,
        ot: 0,
        rate: 35,
        otRate: 35,
        pay: 0,
        otPay: 0,
        bill: 1400,
        jobPay: 0,
        desc: "Warehouse",
        tax: TAX.ON,
      },
      {
        reg: 1,
        ot: 0,
        rate: -50,
        otRate: -50,
        pay: 0,
        otPay: 0,
        bill: -50,
        jobPay: 0,
        desc: "Discount",
        tax: TAX.ZERO,
      },
    ],
    totals: {
      subtotal: 1350,
      hst: 182,
      gst: 0,
      qst: 0,
      tax: 182,
      grand: 1532,
      hours: 41,
    },
  },
];

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const NUMBER = /^\d{6}$/;

for (const language of ["en", "fr"] as const) {
  base.describe(`create in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepInvoices);
    base.afterEach(sweepInvoices);

    for (const c of CASES) {
      base(c.name, async ({ page }) => {
        const calls = watchInvoiceCalls(page);
        await startInvoice(page, c.find);
        await expect(page.locator("html")).toHaveAttribute("lang", language);

        if (c.range) {
          await loadTimesheets(page, c.range[0], c.range[1], c.lines!);
          for (const [i, tax] of (c.taxes ?? []).entries())
            await setTax(page, i, tax);
        }
        for (const [i, t] of (c.typed ?? []).entries()) {
          if (i > 0) {
            // the page names a new line with the clock's milliseconds, which stand still here: move the clock on
            await page.clock.setFixedTime(
              new Date(Date.parse(FIXED_NOW) + i * 1000)
            );
            await page
              .locator(".line-item-buttons .button.secondary")
              .first()
              .click();
            await expect(lineGroups(page)).toHaveCount(i + 1);
          }
          const group = lineGroups(page).nth(i);
          if (t.position)
            await pickIn(
              page,
              group.locator(".custom-dropdown").nth(0),
              t.position
            );
          if (t.person)
            await pickIn(
              page,
              group.locator(".custom-dropdown").nth(1),
              t.person
            );
          if (t.desc)
            await group.locator("input.invoice-text-input").fill(t.desc);
          await typeLine(page, i, t.hours, t.rate);
          if (t.tax) await setTax(page, i, t.tax);
        }

        // what the screen shows, before anything is saved
        expect(await totalsText(page)).toMatchSnapshot([
          "invoices",
          `create-${slug(c.name)}.${language}.totals.txt`,
        ]);

        await page.locator(".timesheet-action-section button.button").click();
        const create = await answered(calls.creates);
        const body = bodyOf(create);
        expect(body.invoiceNumber).toMatch(NUMBER);
        const number = body.invoiceNumber as string;

        // the request body, written by hand
        const from = c.range?.[0] ?? "2026-11-17";
        const to = c.range?.[1] ?? CLIENTS[c.client].due;
        const expected = createBody({
          client: c.client,
          number,
          totals: c.totals,
          lines: c.expect.map((l, i) => createLine(i, l, number, from, to)),
        });
        // line ids are the clock's milliseconds plus the position; typed lines get their own: only their shape counts
        const ids = (b: any) => ({
          ...b,
          invoiceData: {
            ...b.invoiceData,
            timesheets: b.invoiceData.timesheets.map((t: any) => ({
              ...t,
              id: "<id>",
            })),
            supplierPOItems: b.invoiceData.supplierPOItems.map((s: any) => ({
              ...s,
              id: "<id>",
            })),
          },
        });
        sameMoney(ids(body), ids(expected));

        // the document record and the PDF the browser uploaded
        const doc = bodyOf(await answered(calls.documents));
        expect(doc.documentFileName).toBe(
          `Invoice_${number}_${CLIENTS[c.client].companyName.replace(/\s+/g, "_")}.pdf`
        );
        expect(doc.documentPath).toBe(
          `00000000-0000-4000-8000-000000000001/${number}/documents/${doc.documentFileName}`
        );
        expect(doc).toMatchObject({
          documentGenerated: true,
          documentMimeType: "application/pdf",
        });
        const pdf = await storedObject(doc.documentPath);
        expect(pdf.length).toBe(doc.documentFileSize);
        const content = await pdfContent(pdf, { [number]: "<number>" });
        // the PDF has no language: both languages must make the same file
        expect(content).toMatchSnapshot([
          "invoices",
          `create-${slug(c.name)}.pdf.txt`,
        ]);

        // the success window, and the row the database holds
        await expect(
          page.locator(".invoice-success-modal-content")
        ).toBeVisible();
        await expect(
          page.locator(".invoice-success-modal-details")
        ).toContainText(`$${c.totals.grand.toFixed(2)}`);
        const [row] = await savedInvoices();
        expect(row.invoice_number).toBe(number);
        expect(row).toMatchObject({
          client_id: CLIENTS[c.client].id,
          status: "draft",
          currency: CLIENTS[c.client].currency,
          due_date: CLIENTS[c.client].due,
          document_generated: true,
          document_path: doc.documentPath,
        });
        // the table keeps two decimals: the cents worked out by hand (the totals above when they have no more)
        const kept = c.stored ?? {
          subtotal: c.totals.subtotal,
          tax: c.totals.tax,
          grand: c.totals.grand,
        };
        expect([
          Number(row.subtotal),
          Number(row.total_tax),
          Number(row.grand_total),
        ]).toEqual([kept.subtotal, kept.tax, kept.grand]);
        expect(await invoiceById(row.id)).toBeTruthy();
        expect(calls.updates).toHaveLength(0);
        expect(
          invoiceMails().filter((m) => m.subject.includes(number))
        ).toEqual([]);
      });
    }
  });
}

/** The line of an edited invoice (PUT): the page sends fewer fields than for a new one. */
function updateLine(
  i: number,
  l: Line,
  number: string,
  from: string,
  to: string
) {
  const full = createLine(i, l, number, from, to);
  const {
    regularBillRate,
    overtimeBillRate,
    regularPayRate,
    overtimePayRate,
    jobseekerProfile,
    ...rest
  } = full;
  return {
    ...rest,
    regularBillRate,
    overtimeBillRate,
    regularPayRate,
    overtimePayRate,
    jobseekerProfile,
  };
}

/** Creates the four-line Ontario invoice through the page and returns its number, row and stored PDF. */
async function createOntario(
  page: import("@playwright/test").Page,
  calls: ReturnType<typeof watchInvoiceCalls>
) {
  await startInvoice(page, /Northwind/);
  await loadTimesheets(page, "2026-11-01", "2026-11-07", 4);
  await page.locator(".timesheet-action-section button.button").click();
  const number = bodyOf(await answered(calls.creates)).invoiceNumber as string;
  const doc = bodyOf(await answered(calls.documents));
  await answered(calls.uploads);
  await expect(page.locator(".invoice-success-modal-content")).toBeVisible();
  const [row] = await savedInvoices();
  return { number, row, path: doc.documentPath as string };
}

const ONTARIO_LINES: Line[] = CASES[0].expect;

for (const language of ["en", "fr"] as const) {
  base.describe(`edit, send and the PDF in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepInvoices);
    base.afterEach(sweepInvoices);

    base("open a created invoice, change one line, save", async ({ page }) => {
      const calls = watchInvoiceCalls(page);
      const { number, row, path } = await createOntario(page, calls);

      await page.goto(`/invoice-management/create?id=${row.id}`);
      await expect(lineGroups(page)).toHaveCount(4);
      await expect(
        page.locator(".timesheet-grand-total .timesheet-total-value")
      ).toContainText("4746.00");
      expect(await totalsText(page)).toMatchSnapshot([
        "invoices",
        `edit-before.${language}.totals.txt`,
      ]);
      // 35 h instead of 40 on the first line: 35 x 35 = 1,225 + 1,400 + 700 + 700 = 4,025; HST 13% = 523.25; total 4,548.25
      await lineGroups(page)
        .nth(0)
        .locator("input.invoice-number-input")
        .nth(0)
        .fill("35");
      await expect(
        page.locator(".timesheet-grand-total .timesheet-total-value")
      ).toContainText("4548.25");
      expect(await totalsText(page)).toMatchSnapshot([
        "invoices",
        `edit-after.${language}.totals.txt`,
      ]);
      await page.locator(".timesheet-action-section button.button").click();
      const body = bodyOf(await answered(calls.updates));

      const lines = ONTARIO_LINES.map((l, i) =>
        i === 0 ? { ...l, reg: 35, bill: 1225, jobPay: 700 } : l
      );
      const expected = {
        clientId: CLIENTS.northwind.id,
        invoiceDate: "2026-11-17",
        dueDate: "2026-12-17",
        status: "draft",
        currency: "CAD",
        paymentTerms: "Net 30",
        subtotal: 4025,
        totalTax: 523.25,
        totalHst: 523.25,
        totalGst: 0,
        totalQst: 0,
        grandTotal: 4548.25,
        totalHours: 115,
        notes: "",
        invoiceData: {
          client: createBody({
            client: "northwind",
            number,
            totals: {
              subtotal: 0,
              hst: 0,
              gst: 0,
              qst: 0,
              tax: 0,
              grand: 0,
              hours: 0,
            },
            lines: [],
          }).invoiceData.client,
          timesheets: lines.map((l, i) =>
            updateLine(i, l, number, "2026-11-01", "2026-11-07")
          ),
          supplierPOItems: [
            { id: String(FIXED_MS), selectedOption: "", supplierPoNumber: "" },
          ],
          attachments: [],
          messageOnInvoice: MESSAGE_ON_INVOICE,
          termsOnInvoice: TERMS_ON_INVOICE,
          paymentTerms: "Net 30",
          timesheetStartDate: "2026-11-01",
          timesheetEndDate: "2026-11-07",
        },
      };
      sameMoney(body, expected);

      // the PDF is made again and stored in the same place; the row holds the new totals and a new version
      const doc = bodyOf(await answered(calls.documents, 2));
      expect(doc.documentPath).toBe(path);
      await answered(calls.uploads, 2);
      expect(
        await pdfContent(await storedObject(path), { [number]: "<number>" })
      ).toMatchSnapshot(["invoices", "edit-ontario-after.pdf.txt"]);
      const after = await invoiceById(row.id);
      expect([
        Number(after.subtotal),
        Number(after.total_tax),
        Number(after.grand_total),
        Number(after.total_hours),
      ]).toEqual([4025, 523.25, 4548.25, 115]);
      expect(after.version).toBe(2);
      expect(calls.creates).toHaveLength(1);
    });

    base(
      "saving an invoice again with nothing changed makes the same PDF",
      async ({ page }) => {
        const calls = watchInvoiceCalls(page);
        const { number, row, path } = await createOntario(page, calls);
        const first = await storedObject(path);
        const firstContent = await pdfContent(first, { [number]: "<number>" });

        await page.goto(`/invoice-management/create?id=${row.id}`);
        await expect(lineGroups(page)).toHaveCount(4);
        await expect(
          page.locator(".timesheet-grand-total .timesheet-total-value")
        ).toContainText("4746.00");
        await page.locator(".timesheet-action-section button.button").click();
        const body = bodyOf(await answered(calls.updates));
        expect(body.grandTotal).toBeCloseTo(4746, 8);
        await answered(calls.documents, 2);
        await answered(calls.uploads, 2);
        const second = await storedObject(path);
        const secondContent = await pdfContent(second, {
          [number]: "<number>",
        });
        // the same content, item by item, and the same as the file the first save made
        expect(secondContent).toBe(firstContent);
        expect(secondContent).toMatchSnapshot([
          "invoices",
          "create-ontario-hst-four-timesheet-lines.pdf.txt",
        ]);
        console.log(
          `PDF bytes: first ${first.length}, second ${second.length}, identical bytes: ${first.equals(second)}`
        );
      }
    );

    base(
      "send the invoice from the success window: the address, the message recorded",
      async ({ page }) => {
        const calls = watchInvoiceCalls(page);
        const before = invoiceMails().length;
        const { number } = await createOntario(page, calls);
        const email = page.locator(
          ".invoice-success-modal-email-section input[type=email]"
        );
        await expect(email).toHaveValue("nora.north@example.test");
        await page
          .locator(".invoice-success-modal-email-section button.button")
          .click();
        const sent = await answered(calls.sends);
        expect(bodyOf(sent)).toEqual({ email: "nora.north@example.test" });
        await expect(
          page.locator(".invoice-success-modal-email-section")
        ).toContainText("nora.north@example.test");
        await expect.poll(() => invoiceMails().length - before).toBe(1);
        const [mail] = invoiceMails().slice(before);
        expect(mail).toEqual({
          to: ["nora.north@example.test"],
          cc: [],
          subject: `Invoice #${number} for Northwind Test Staffing Client`,
          attachments: [`Invoice_${number}_Northwind_Test_Staffing_Client.pdf`],
        });
        const [row] = await savedInvoices();
        expect(row).toMatchObject({
          email_sent: true,
          invoice_sent_to: "nora.north@example.test",
        });
      }
    );
  });
}
