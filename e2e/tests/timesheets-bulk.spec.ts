// Timesheets, the two bulk screens, as the admin, in English and in French (R-4, gate d).
//   /bulk-timesheet-management            by client: one client and position, every jobseeker assigned to it
//   /bulk-timesheet-management/jobseeker  by jobseeker: one jobseeker, one or more positions of a client
// Each case types the hours like a person does and pins the request bodies the browser sends (written by hand from the
// seed's rates, exact to the cent), the invoice lines and totals the screen shows, and the rows the database holds.
// The week is 7 to 13 December 2025: no seeded row and no Reports journey is there; the rows are removed after each test.
import { expect, test as base } from "../support/fixtures";
import {
  CLIENT,
  DEC_7,
  POSITION,
  PROFILE,
  USER,
  days,
  invoiceText,
  maskInvoice,
  pick,
  savedBodies,
  savedRows,
  sweepTimesheets,
  watchSaves,
  weekStart,
} from "../support/timesheet-screens";

base.describe.configure({ mode: "serial" });

const WEEK = weekStart(40); // 2025-12-07
const END = days(WEEK, [0, 0, 0, 0, 0, 0, 0])[6].date;

/** Types hours into the seven day boxes of the card (Sunday first). */
async function typeCard(
  card: import("@playwright/test").Locator,
  hours: number[]
) {
  const inputs = card.locator(
    ".timesheet-hours-section:not(.adjustments-section) .timesheet-hours-input"
  );
  await expect(inputs).toHaveCount(7);
  for (const [i, h] of hours.entries())
    if (h > 0) await inputs.nth(i).fill(String(h));
}

/** The part of a bulk body that does not depend on the screen: what the browser sends for one jobseeker. */
const bulkBody = (o: {
  who: "sin" | "cash";
  positionId: string;
  hours: number[];
  regular: number;
  pay: number;
  bill: number;
  breakdown: Array<Record<string, unknown>>;
}) => ({
  jobseeker_profile_id: PROFILE[o.who],
  jobseeker_user_id: USER[o.who],
  position_id: o.positionId,
  week_start_date: WEEK,
  week_end_date: END,
  daily_hours: days(WEEK, o.hours),
  total_regular_hours: o.regular,
  total_overtime_hours: 0,
  regular_pay_rate: 20,
  premium_pay_rate: 0,
  overtime_pay_rate: 20,
  regular_bill_rate: 35,
  overtime_bill_rate: 35,
  total_jobseeker_pay: o.pay,
  total_client_bill: o.bill,
  bonus_amount: 0,
  deduction_amount: 0,
  tax_amount: 0,
  notes: "Aggregated Bulk Timesheet",
  overtime_enabled: true,
  email_sent: false,
  pay_split_segment: "single",
  line_payment_method: null,
  is_bulk: true,
  bulk_breakdown: o.breakdown,
  invoice_number: "<six digits>",
});

const line = (o: {
  positionId: string;
  title: string;
  code: string;
  hours: number[];
  regular: number;
  pay: number;
  bill: number;
}) => ({
  position_id: o.positionId,
  position_title: o.title,
  position_code: o.code,
  regular_hours: o.regular,
  overtime_hours: 0,
  total_jobseeker_pay: o.pay,
  total_client_bill: o.bill,
  regular_pay_rate: 20,
  regular_bill_rate: 35,
  bonus_amount: 0,
  deduction_amount: 0,
  tax_amount: 0,
  notes: "",
  // the screen's own day rows carry an overtime figure of their own
  entries: days(WEEK, o.hours).map((d) => ({ ...d, overtimeHours: 0 })),
});

for (const language of ["en", "fr"] as const) {
  base.describe(`bulk in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepTimesheets);
    base.afterEach(sweepTimesheets);

    base(
      "by client: one client and position, two jobseekers, save",
      async ({ page }) => {
        const sent = watchSaves(page);
        await page.goto("/bulk-timesheet-management");
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await pick(page, 0, "Northwind");
        await pick(page, 1, "Warehouse Associate");
        await pick(page, 2, DEC_7);
        const cards = page.locator(".timesheet-assignment-card");
        // the three jobseekers assigned to the position (Sam, Casey, Hana) are loaded; Hana is taken off this one
        await expect(cards).toHaveCount(3);
        await cards
          .filter({ hasText: "Hana Hybrid" })
          .locator("button.button.danger")
          .click();
        await expect(cards).toHaveCount(2);
        const sam = cards.filter({ hasText: "Sam Sinclair" });
        const casey = cards.filter({ hasText: "Casey Cashman" });
        await typeCard(sam, [0, 8, 8, 8, 8, 8, 0]);
        await typeCard(casey, [0, 8, 8, 8, 8, 8, 0]);

        // the totals the screen shows: each jobseeker's own, then the whole
        await expect(sam.locator(".timesheet-grand-total")).toContainText(
          "800.00"
        );
        await expect(casey.locator(".timesheet-grand-total")).toContainText(
          "720.00"
        );
        expect(
          await invoiceText(page, ".bulk-timesheet-forms-container")
        ).toMatchSnapshot([
          "timesheets",
          `bulk-by-client.${language}.totals.txt`,
        ]);

        await page.locator(".timesheet-action-section button.button").click();
        const saved = await savedBodies(sent, 2);
        const warehouse = {
          positionId: POSITION.warehouse,
          title: "Warehouse Associate",
          code: "NW001",
        };
        const hours = [0, 8, 8, 8, 8, 8, 0];
        const byUser = Object.fromEntries(
          saved.map((s) => [s.body.jobseeker_user_id, s])
        );
        expect(saved.map((s) => [s.method, s.path])).toEqual([
          ["POST", "/api/timesheets"],
          ["POST", "/api/timesheets"],
        ]);
        expect(maskInvoice(byUser[USER.sin].body)).toEqual(
          bulkBody({
            who: "sin",
            positionId: POSITION.warehouse,
            hours,
            regular: 40,
            pay: 800,
            bill: 1400,
            breakdown: [
              line({ ...warehouse, hours, regular: 40, pay: 800, bill: 1400 }),
            ],
          })
        );
        expect(maskInvoice(byUser[USER.cash].body)).toEqual(
          bulkBody({
            who: "cash",
            positionId: POSITION.warehouse,
            hours,
            regular: 40,
            pay: 720,
            bill: 1400,
            breakdown: [
              line({ ...warehouse, hours, regular: 40, pay: 720, bill: 1400 }),
            ],
          })
        );
        const rows = await savedRows();
        expect(
          rows
            .map((r) => [
              r.jobseeker_user_id,
              r.is_bulk,
              Number(r.total_jobseeker_pay),
              Number(r.total_client_bill),
            ])
            .sort()
        ).toEqual(
          [
            [USER.sin, true, 800, 1400],
            [USER.cash, true, 720, 1400],
          ].sort()
        );
      }
    );

    base(
      "by jobseeker: one jobseeker, two positions, save",
      async ({ page }) => {
        const sent = watchSaves(page);
        await page.goto("/bulk-timesheet-management/jobseeker");
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await pick(page, 0, "Sam Sinclair");
        await pick(page, 1, "Northwind");
        await pick(page, 2, DEC_7);
        await expect(
          page.getByText(/Loading existing timesheets|Chargement des feuilles/)
        ).toHaveCount(0, { timeout: 20_000 });
        const cards = page.locator(".bulk-jobseeker-position-card");
        await expect(cards).toHaveCount(1);
        await pick(page, 3, "Warehouse Associate");
        // the form of the first position is built before the next row is added
        await expect(
          cards.nth(0).locator(".timesheet-hours-input").first()
        ).toBeVisible();
        await page
          .locator("button", { hasText: /Add another position|Ajouter/ })
          .click();
        await expect(cards).toHaveCount(2);
        // a new row goes to the top: the screen's first card is the new one (Forklift), the Warehouse row is the second
        await pick(page, 3, "Forklift Operator");
        await expect(
          cards.nth(0).locator(".timesheet-hours-input").first()
        ).toBeVisible();
        // Forklift: Friday and Saturday 10 h = 20 h (under its 40 h threshold); Warehouse: Monday to Thursday 8 h = 32 h
        await typeCard(cards.nth(0), [0, 0, 0, 0, 0, 10, 10]);
        await typeCard(cards.nth(1), [0, 8, 8, 8, 8, 0, 0]);
        await expect(
          cards.nth(0).locator(".timesheet-grand-total")
        ).toContainText("400.00");
        await expect(
          cards.nth(1).locator(".timesheet-grand-total")
        ).toContainText("640.00");
        expect(
          await invoiceText(
            page,
            ".bulk-timesheet-forms-container, .timesheet-content-container"
          )
        ).toMatchSnapshot([
          "timesheets",
          `bulk-by-jobseeker.${language}.totals.txt`,
        ]);

        await page.locator(".timesheet-action-section button.button").click();
        const [saved] = await savedBodies(sent, 1);
        expect(saved.method).toBe("POST");
        // one save for the jobseeker: the two positions are lines of one bulk timesheet, in the order of the screen's
        // rows; the totals are their sum (32 h x 20 + 20 h x 20 = 1,040 pay; 52 h x 35 = 1,820 bill); the top-level
        // position and rates are the first row's (Forklift: pay 20, overtime pay 30, bill 35, overtime bill 52.50)
        expect(maskInvoice(saved.body)).toEqual({
          ...bulkBody({
            who: "sin",
            positionId: POSITION.forklift,
            hours: [0, 8, 8, 8, 8, 10, 10],
            regular: 52,
            pay: 1040,
            bill: 1820,
            breakdown: [
              line({
                positionId: POSITION.forklift,
                title: "Forklift Operator",
                code: "NW002",
                hours: [0, 0, 0, 0, 0, 10, 10],
                regular: 20,
                pay: 400,
                bill: 700,
              }),
              line({
                positionId: POSITION.warehouse,
                title: "Warehouse Associate",
                code: "NW001",
                hours: [0, 8, 8, 8, 8, 0, 0],
                regular: 32,
                pay: 640,
                bill: 1120,
              }),
            ],
          }),
          overtime_pay_rate: 30,
          overtime_bill_rate: 52.5,
        });
        const [row] = await savedRows();
        expect([
          row.is_bulk,
          Number(row.total_jobseeker_pay),
          Number(row.total_client_bill),
          row.bulk_breakdown.length,
        ]).toEqual([true, 1040, 1820, 2]);
      }
    );
  });
}

// ---- "send to all" (R-4b): ticking it marks every jobseeker's timesheet to be emailed ----------------------------------

base.describe("send to all", () => {
  base.use({ language: "en", storageState: ".auth/admin.json" });
  base.beforeAll(sweepTimesheets);
  base.afterEach(sweepTimesheets);

  base(
    "by client: every saved timesheet is marked as emailed",
    async ({ page }) => {
      const sent = watchSaves(page);
      await page.goto("/bulk-timesheet-management");
      await pick(page, 0, "Northwind");
      await pick(page, 1, "Warehouse Associate");
      await pick(page, 2, DEC_7);
      const cards = page.locator(".timesheet-assignment-card");
      await expect(cards).toHaveCount(3);
      await cards
        .filter({ hasText: "Hana Hybrid" })
        .locator("button.button.danger")
        .click();
      await expect(cards).toHaveCount(2);
      for (const who of ["Sam Sinclair", "Casey Cashman"])
        await typeCard(cards.filter({ hasText: who }), [0, 8, 8, 8, 8, 8, 0]);
      const all = page.locator(".timesheet-action-section .timesheet-checkbox");
      const each = cards.locator(".timesheet-checkbox");
      await expect(each).toHaveCount(2);
      await expect(all).not.toBeChecked();
      await all.check();
      await expect(each.first()).toBeChecked();
      await expect(each.last()).toBeChecked();
      // one jobseeker's own tick off: "send to all" lets go, and ticking it again puts every row back
      await each.first().uncheck();
      await expect(all).not.toBeChecked();
      await all.check();
      await expect(each.first()).toBeChecked();

      await page.locator(".timesheet-action-section button.button").click();
      const saved = await savedBodies(sent, 2);
      expect(saved.map((s) => s.body.email_sent)).toEqual([true, true]);
    }
  );

  base(
    "by jobseeker: the one saved timesheet is marked as emailed",
    async ({ page }) => {
      const sent = watchSaves(page);
      await page.goto("/bulk-timesheet-management/jobseeker");
      await pick(page, 0, "Sam Sinclair");
      await pick(page, 1, "Northwind");
      await pick(page, 2, DEC_7);
      await pick(page, 3, "Warehouse Associate");
      const card = page.locator(".bulk-jobseeker-position-card");
      await expect(card).toHaveCount(1);
      await typeCard(card, [0, 8, 8, 8, 8, 8, 0]);
      const all = page.locator(".timesheet-action-section .timesheet-checkbox");
      await expect(all).not.toBeChecked();
      await all.check();
      await page.locator(".timesheet-action-section button.button").click();
      const saved = await savedBodies(sent, 1);
      expect(saved[0].body.email_sent).toBe(true);
    }
  );
});

base.describe("removing a jobseeker from the bulk-by-client screen", () => {
  base.use({ language: "en", storageState: ".auth/admin.json" });

  base("the last one left cannot be removed", async ({ page }) => {
    await page.goto("/bulk-timesheet-management");
    await pick(page, 0, "Northwind");
    await pick(page, 1, "Warehouse Associate");
    await pick(page, 2, DEC_7);
    const cards = page.locator(".timesheet-assignment-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.locator("button.button.danger").first()).toBeEnabled();
    for (const who of ["Hana Hybrid", "Casey Cashman"])
      await cards
        .filter({ hasText: who })
        .locator("button.button.danger")
        .click();
    await expect(cards).toHaveCount(1);
    await expect(cards.locator("button.button.danger")).toBeDisabled();
  });
});
