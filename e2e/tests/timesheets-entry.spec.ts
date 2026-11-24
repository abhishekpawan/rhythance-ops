// Timesheets, the single entry screen (/timesheet-management), as the admin, in English and in French (R-4, gate d).
// Money is calculated in the browser and the server stores what it is sent, so each case types the week like a person
// does and pins three things: the request body the browser sends to save (written here by hand from the seed's rates,
// exact to the cent), the invoice lines and totals the screen shows (as text), and the rows the database holds after.
//
// The cases are the seed's money cases (server/tests/seed/data.sql): an ordinary position; the overtime position past
// 40 h; cash with the 10% deduction; a hybrid SIN + cash jobseeker (two rows, the cap); a corporation with HST and a
// premium rate; a bonus and a deduction; a hybrid SIN + e-Transfer jobseeker with a bonus. One more opens a saved
// timesheet, changes one day and saves (an update).
//
// The tests run one after the other (they write timesheets, and the list and view journeys read them): every row goes in
// weeks of 2025, which no other journey and no seeded row uses, and is removed after each test with the service key.
import { expect, test as base } from "../support/fixtures";
import {
  CLIENT,
  POSITION,
  PROFILE,
  USER,
  createThroughServer,
  days,
  entryUrl,
  invoiceText,
  maskInvoice,
  savedBodies,
  savedRows,
  sweepTimesheets,
  typeHours,
  typePay,
  watchSaves,
  weekStart,
} from "../support/timesheet-screens";

base.describe.configure({ mode: "serial" });

type Case = {
  name: string;
  who: keyof typeof PROFILE;
  client: string;
  position: string;
  week: number;
  hours: number[];
  bonus?: number;
  deduction?: number;
  /** the bodies the browser must send, in order, written by hand */
  expected: (week: string) => Array<Record<string, unknown>>;
};

const common = (week: string) => ({
  week_start_date: week,
  week_end_date: days(week, [0, 0, 0, 0, 0, 0, 0])[6].date,
  notes: "",
  email_sent: false,
});

const CASES: Case[] = [
  {
    // 40 h x 20 = 800 pay, 40 h x 35 = 1,400 bill
    name: "an ordinary week",
    who: "sin",
    client: CLIENT.northwind,
    position: POSITION.warehouse,
    week: 0,
    hours: [0, 8, 8, 8, 8, 8, 0],
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.sin,
        jobseeker_user_id: USER.sin,
        position_id: POSITION.warehouse,
        daily_hours: days(w, [0, 8, 8, 8, 8, 8, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 800,
        total_client_bill: 1400,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 0,
        overtime_enabled: false,
        markup: 75,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // 50 h: 40 x 20 + 10 x 30 = 1,100 pay; 40 x 35 + 10 x 52.50 = 1,925 bill
    name: "the overtime position past 40 hours",
    who: "sin",
    client: CLIENT.northwind,
    position: POSITION.forklift,
    week: 1,
    hours: [0, 10, 10, 10, 10, 10, 0],
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.sin,
        jobseeker_user_id: USER.sin,
        position_id: POSITION.forklift,
        daily_hours: days(w, [0, 10, 10, 10, 10, 10, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 10,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 30,
        regular_bill_rate: 35,
        overtime_bill_rate: 52.5,
        total_jobseeker_pay: 1100,
        total_client_bill: 1925,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 0,
        overtime_enabled: true,
        markup: 75,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // cash, 10% off: 40 x 20 = 800, less 80 = 720 pay; bill 1,400
    name: "cash with the 10% deduction",
    who: "cash",
    client: CLIENT.northwind,
    position: POSITION.warehouse,
    week: 2,
    hours: [0, 8, 8, 8, 8, 8, 0],
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.cash,
        jobseeker_user_id: USER.cash,
        position_id: POSITION.warehouse,
        daily_hours: days(w, [0, 8, 8, 8, 8, 8, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 720,
        total_client_bill: 1400,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 0,
        overtime_enabled: false,
        markup: 75,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // hybrid SIN + cash, cap 20 h, 40 h worked: the first 20 h (Mon, Tue, 4 h of Wed) are SIN: pay 400, bill 700;
    // the other 20 h are cash: pay 400 less 10% = 360, bill 700. Two saves.
    name: "a hybrid SIN and cash jobseeker (two rows, the cap)",
    who: "hybrid",
    client: CLIENT.northwind,
    position: POSITION.warehouse,
    week: 3,
    hours: [0, 8, 8, 8, 8, 8, 0],
    expected: (w) => {
      const rows = (segment: "sin" | "cash", hours: number[]) => ({
        ...common(w),
        jobseeker_profile_id: PROFILE.hybrid,
        jobseeker_user_id: USER.hybrid,
        position_id: POSITION.warehouse,
        daily_hours: days(w, hours),
        total_regular_hours: 20,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: segment === "sin" ? 400 : 360,
        total_client_bill: 700,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 0,
        overtime_enabled: false,
        markup: 75,
        pay_split_segment: segment,
        line_payment_method: segment === "sin" ? "SIN-Direct Deposit" : "Cash",
        invoice_number: "<six digits>",
      });
      return [
        rows("sin", [0, 8, 8, 4, 0, 0, 0]),
        rows("cash", [0, 0, 0, 4, 8, 8, 0]),
      ];
    },
  },
  {
    // a corporation, HST 13%, premium 2.5 on 20: 40 x 22.50 = 900, tax 117, pay 1,017; bill 1,400
    name: "a corporation with HST",
    who: "corp",
    client: CLIENT.quebec,
    position: POSITION.driver,
    week: 4,
    hours: [0, 8, 8, 8, 8, 8, 0],
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.corp,
        jobseeker_user_id: USER.corp,
        position_id: POSITION.driver,
        daily_hours: days(w, [0, 8, 8, 8, 8, 8, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 2.5,
        overtime_pay_rate: 22.5,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 1017,
        total_client_bill: 1400,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 117,
        overtime_enabled: false,
        markup: 70,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // the same corporation with 37.5 h: 37.5 x 22.50 = 843.75, tax 13% = 109.6875 reported as 109.69, pay 843.75 +
    // 109.6875 = 953.4375 saved as 953.44 (a cent rounded the other way would show here); bill 37.5 x 35 = 1,312.50
    name: "a corporation with HST on part of a cent",
    who: "corp",
    client: CLIENT.quebec,
    position: POSITION.driver,
    week: 7,
    hours: [0, 7.5, 7.5, 7.5, 7.5, 7.5, 0],
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.corp,
        jobseeker_user_id: USER.corp,
        position_id: POSITION.driver,
        daily_hours: days(w, [0, 7.5, 7.5, 7.5, 7.5, 7.5, 0]),
        total_regular_hours: 37.5,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 2.5,
        overtime_pay_rate: 22.5,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 953.44,
        total_client_bill: 1312.5,
        bonus_amount: 0,
        deduction_amount: 0,
        tax_amount: 109.69,
        overtime_enabled: false,
        markup: 70,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // an ordinary week with a bonus of 50 and a deduction of 20: 800 + 50 - 20 = 830; the client is billed 1,400
    name: "a bonus and a deduction",
    who: "sin",
    client: CLIENT.northwind,
    position: POSITION.warehouse,
    week: 5,
    hours: [0, 8, 8, 8, 8, 8, 0],
    bonus: 50,
    deduction: 20,
    expected: (w) => [
      {
        ...common(w),
        jobseeker_profile_id: PROFILE.sin,
        jobseeker_user_id: USER.sin,
        position_id: POSITION.warehouse,
        daily_hours: days(w, [0, 8, 8, 8, 8, 8, 0]),
        total_regular_hours: 40,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: 830,
        total_client_bill: 1400,
        bonus_amount: 50,
        deduction_amount: 20,
        tax_amount: 0,
        overtime_enabled: false,
        markup: 75,
        pay_split_segment: "single",
        line_payment_method: null,
        invoice_number: "<six digits>",
      },
    ],
  },
  {
    // hybrid SIN + e-Transfer, cap 30 h, 40 h worked, bonus 50 on the SIN row: SIN 30 x 20 = 600 + 50 = 650, bill 1,050;
    // e-Transfer 10 x 20 = 200 less 5% = 190, bill 350
    name: "a hybrid SIN and e-Transfer jobseeker with a bonus",
    who: "hybridEt",
    client: CLIENT.pacific,
    position: POSITION.loader,
    week: 6,
    hours: [0, 10, 10, 10, 10, 0, 0],
    bonus: 50,
    expected: (w) => {
      const row = (segment: "sin" | "e_transfer", hours: number[]) => ({
        ...common(w),
        jobseeker_profile_id: PROFILE.hybridEt,
        jobseeker_user_id: USER.hybridEt,
        position_id: POSITION.loader,
        daily_hours: days(w, hours),
        total_regular_hours: segment === "sin" ? 30 : 10,
        total_overtime_hours: 0,
        regular_pay_rate: 20,
        premium_pay_rate: 0,
        overtime_pay_rate: 20,
        regular_bill_rate: 35,
        overtime_bill_rate: 35,
        total_jobseeker_pay: segment === "sin" ? 650 : 190,
        total_client_bill: segment === "sin" ? 1050 : 350,
        bonus_amount: segment === "sin" ? 50 : 0,
        deduction_amount: 0,
        tax_amount: 0,
        overtime_enabled: false,
        markup: 75,
        pay_split_segment: segment,
        line_payment_method:
          segment === "sin" ? "SIN-Direct Deposit" : "e-Transfer",
        invoice_number: "<six digits>",
      });
      return [
        row("sin", [0, 10, 10, 10, 0, 0, 0]),
        row("e_transfer", [0, 0, 0, 0, 10, 0, 0]),
      ];
    },
  },
];

for (const language of ["en", "fr"] as const) {
  base.describe(`entry in ${language}`, () => {
    base.use({ language, storageState: ".auth/admin.json" });
    base.beforeAll(sweepTimesheets);
    base.afterEach(sweepTimesheets);

    for (const c of CASES) {
      base(c.name, async ({ page }) => {
        const week = weekStart(c.week);
        const sent = watchSaves(page);
        await page.goto(
          entryUrl({
            profile: PROFILE[c.who],
            client: c.client,
            position: c.position,
            week,
          })
        );
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator(".timesheet-assignment-card")).toBeVisible();
        await typeHours(page, c.hours);
        await typePay(page, c.bonus ?? 0, c.deduction ?? 0);

        // the totals the screen shows before saving
        await expect(page.locator(".timesheet-grand-total")).toBeVisible();
        expect(await invoiceText(page)).toMatchSnapshot([
          "timesheets",
          `entry-${c.name.replace(/[^a-z0-9]+/gi, "-")}.${language}.totals.txt`,
        ]);

        await page.locator(".timesheet-action-section button.button").click();
        const expected = c.expected(week);
        const saved = await savedBodies(sent, expected.length);
        expect(saved.map((s) => s.method)).toEqual(expected.map(() => "POST"));
        expect(saved.map((s) => maskInvoice(s.body))).toEqual(expected);
        // the second row of a hybrid week gets the next number
        if (saved.length === 2)
          expect(Number(saved[1].body.invoice_number)).toBe(
            Number(saved[0].body.invoice_number) + 1
          );

        // what the database holds after: the totals as sent, to the cent
        const rows = await savedRows();
        expect(
          rows.map((r) => [
            r.pay_split_segment,
            Number(r.total_regular_hours),
            Number(r.total_jobseeker_pay),
            Number(r.total_client_bill),
            Number(r.tax_amount),
          ])
        ).toEqual(
          expected
            .map((e) => [
              e.pay_split_segment,
              e.total_regular_hours,
              e.total_jobseeker_pay,
              e.total_client_bill,
              e.tax_amount,
            ])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        );
        // the screen is back to an empty form
        await expect(page.locator(".timesheet-assignment-card")).toHaveCount(0);
      });
    }

    base(
      "opening a saved timesheet, changing one day and saving",
      async ({ page }) => {
        const week = weekStart(8);
        const first = await createThroughServer({
          jobseeker_profile_id: PROFILE.sin,
          jobseeker_user_id: USER.sin,
          position_id: POSITION.warehouse,
          week_start_date: week,
          week_end_date: days(week, [0, 0, 0, 0, 0, 0, 0])[6].date,
          daily_hours: days(week, [0, 8, 8, 8, 8, 8, 0]),
          total_regular_hours: 40,
          total_overtime_hours: 0,
          regular_pay_rate: 20,
          premium_pay_rate: 0,
          overtime_pay_rate: 20,
          regular_bill_rate: 35,
          overtime_bill_rate: 35,
          total_jobseeker_pay: 800,
          total_client_bill: 1400,
          bonus_amount: 0,
          deduction_amount: 0,
          tax_amount: 0,
          overtime_enabled: false,
          notes: "",
          email_sent: false,
          pay_split_segment: "single",
          line_payment_method: null,
          invoice_number: "810001",
        });
        const sent = watchSaves(page);
        await page.goto(
          entryUrl({
            profile: PROFILE.sin,
            client: CLIENT.northwind,
            position: POSITION.warehouse,
            week,
          })
        );
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator(".timesheet-assignment-card")).toBeVisible();
        // the saved hours are on the screen
        const wednesday = page
          .locator(
            ".timesheet-hours-section:not(.adjustments-section) .timesheet-hours-input"
          )
          .nth(3);
        await expect(wednesday).toHaveValue("8");
        expect(await invoiceText(page)).toMatchSnapshot([
          "timesheets",
          `entry-edit-before.${language}.totals.txt`,
        ]);
        // Wednesday 8 h -> 10 h: 42 h, pay 42 x 20 = 840, bill 42 x 35 = 1,470
        await wednesday.fill("10");
        await expect(page.locator(".timesheet-grand-total")).toContainText(
          "840.00"
        );
        expect(await invoiceText(page)).toMatchSnapshot([
          "timesheets",
          `entry-edit-after.${language}.totals.txt`,
        ]);
        await page.locator(".timesheet-action-section button.button").click();
        const [saved] = await savedBodies(sent, 1);
        expect(saved.method).toBe("PUT");
        expect(saved.path).toBe(`/api/timesheets/${first.id}`);
        expect(saved.body).toEqual({
          jobseeker_profile_id: PROFILE.sin,
          jobseeker_user_id: USER.sin,
          position_id: POSITION.warehouse,
          week_start_date: week,
          week_end_date: days(week, [0, 0, 0, 0, 0, 0, 0])[6].date,
          daily_hours: days(week, [0, 8, 8, 10, 8, 8, 0]),
          total_regular_hours: 42,
          total_overtime_hours: 0,
          regular_pay_rate: 20,
          premium_pay_rate: 0,
          overtime_pay_rate: 20,
          regular_bill_rate: 35,
          overtime_bill_rate: 35,
          total_jobseeker_pay: 840,
          total_client_bill: 1470,
          bonus_amount: 0,
          deduction_amount: 0,
          tax_amount: 0,
          notes: "",
          overtime_enabled: false,
          markup: 75,
          email_sent: false,
          pay_split_segment: "single",
          line_payment_method: null,
        });
        const [row] = await savedRows();
        expect([
          row.id,
          Number(row.total_jobseeker_pay),
          Number(row.total_client_bill),
          row.invoice_number,
        ]).toEqual([first.id, 840, 1470, "810001"]);
      }
    );
  });
}
