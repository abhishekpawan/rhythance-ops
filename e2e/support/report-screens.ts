// The nine Reports screens: how a person gets each one to show data, and the request body the browser
// must send to the server for it. The bodies are worked out from the screens' code (what each filter
// holds), not copied from a run; ids come from the test seed.
import type { Page } from "@playwright/test";
import { CLIENTS, PROFILES } from "../../server/tests/seed/ids.mjs";
import { choose } from "./ui";

const allClients = Object.values(CLIENTS) as string[];
const allProfiles = Object.values(PROFILES) as string[];

export type ReportScreen = {
  /** snapshot name and test title */
  name: string;
  path: string;
  endpoint: string;
  /** the request body the browser sends once the filters below are set */
  body: Record<string, unknown>;
  /** sets the filters the way a person does */
  drive: (page: Page) => Promise<void>;
  /** rows with equal sort keys come back in no fixed order (see the API pins' tiesBy): compare sorted */
  unorderedRows?: boolean;
};

const fillDates = async (page: Page, start: string, end: string) => {
  await page.locator("#start-date-input").fill(start);
  await page.locator("#end-date-input").fill(end);
};

const WHOLE_YEAR = { startDate: "2026-01-01", endDate: "2026-12-31" };
const NOVEMBER = { startDate: "2026-11-01", endDate: "2026-11-30" };
const ENVELOPE_RANGE = { startDate: "2026-10-25", endDate: "2026-11-14" };

export const REPORT_SCREENS: ReportScreen[] = [
  {
    name: "weekly-timesheet",
    path: "/reports/weekly-timesheet",
    endpoint: "/api/reports/timesheet",
    unorderedRows: true,
    body: {
      jobseekerIds: allProfiles,
      clientIds: [],
      weekPeriods: [
        { start: "2026-10-25", end: "2026-10-31" },
        { start: "2026-11-01", end: "2026-11-07" },
        { start: "2026-11-08", end: "2026-11-14" },
      ],
      payCycles: [],
      listNames: [],
    },
    drive: async (page) => {
      // the screen asks the server once it has both: weeks first, job seekers last, so there is one request
      await choose(
        page,
        2, // week periods
        "Oct 25, 2026 - Oct 31, 2026",
        "Nov 1, 2026 - Nov 7, 2026",
        "Nov 8, 2026 - Nov 14, 2026"
      );
      await choose(page, 0, "all"); // job seekers
    },
  },
  {
    name: "deduction",
    path: "/reports/deduction",
    endpoint: "/api/reports/deduction",
    body: NOVEMBER,
    drive: (page) => fillDates(page, NOVEMBER.startDate, NOVEMBER.endDate),
  },
  {
    name: "margin",
    path: "/reports/margin",
    endpoint: "/api/reports/margin",
    body: WHOLE_YEAR,
    drive: (page) => fillDates(page, WHOLE_YEAR.startDate, WHOLE_YEAR.endDate),
  },
  {
    name: "rate-list",
    path: "/reports/rate-list",
    endpoint: "/api/reports/rate-list",
    unorderedRows: true,
    body: { clientIds: allClients },
    drive: (page) => choose(page, 0, "all"),
  },
  {
    name: "invoice",
    path: "/reports/invoice",
    endpoint: "/api/reports/invoice",
    body: WHOLE_YEAR,
    drive: (page) => fillDates(page, WHOLE_YEAR.startDate, WHOLE_YEAR.endDate),
  },
  {
    name: "clients",
    path: "/reports/clients",
    endpoint: "/api/reports/clients",
    // the screen first asks for every client (body {}), reads the client managers out of the answer, then
    // selects every manager, payment method and payment term (its defaults, PAYMENT_METHODS and
    // PAYMENT_TERMS in client/src/constants/formOptions.ts) and asks again with those lists
    body: {
      clientManagerIds: ["Test Recruiter Manager"],
      paymentMethods: [
        "Cash",
        "Corporation-Cheque",
        "Corporation-Direct Deposit",
        "e-Transfer",
        "SIN-Direct Deposit",
        "SIN and cash",
        "SIN and e-Transfer",
        "Cheque",
      ],
      terms: [
        "Due on Receipt",
        "Net 15",
        "Net 22",
        "Net 30",
        "Net 45",
        "Net 60",
        "Net 65",
        "Net 90",
      ],
    },
    drive: async () => {
      // nothing to set: the screen shows every client as soon as it opens
    },
  },
  {
    name: "sales",
    path: "/reports/sales",
    endpoint: "/api/reports/sales",
    body: { clientIds: allClients, ...WHOLE_YEAR },
    drive: async (page) => {
      await choose(page, 0, "all");
      await fillDates(page, WHOLE_YEAR.startDate, WHOLE_YEAR.endDate);
    },
  },
  {
    name: "envelope-printing-position",
    path: "/reports/envelope-printing-position",
    endpoint: "/api/reports/envelope-printing-position",
    unorderedRows: true,
    body: { clientIds: allClients, ...ENVELOPE_RANGE },
    drive: async (page) => {
      // the screen asks the server as soon as a client is chosen (it starts with the last month's dates), so
      // the dates are set first and the client last: one request, no answer to an earlier one to overtake it
      await fillDates(page, ENVELOPE_RANGE.startDate, ENVELOPE_RANGE.endDate);
      await choose(page, 0, "all");
    },
  },
  {
    name: "envelope-printing-by-due-date",
    path: "/reports/envelope-printing-by-due-date",
    endpoint: "/api/reports/envelope-printing-by-due-date",
    unorderedRows: true,
    body: { clientIds: allClients, dueDate: "2026-11-20" },
    drive: async (page) => {
      // as above: the due date first (it starts as today), the client last, so there is one request
      await page.locator("#due-date-input").fill("2026-11-20");
      await choose(page, 0, "all");
    },
  },
];
