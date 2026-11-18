// API pins for the nine Reports endpoints of server/src/routes/reports.ts (D4.2 of the refactor plan).
// Each endpoint: its answers to the requests below, every staff role that may call it, a jobseeker that may not.
// Dates are asked on the fixed-clock server (17 November 2026), because the "inactive" flags compare with today.
// Where an answer looks wrong it is pinned as it is; the list of those is in the SAFE-2b report.
import { CLIENTS, PROFILES } from "../seed/ids.mjs";
import { pinEndpoint } from "./pin";

const allClients = Object.values(CLIENTS);
const allProfiles = Object.values(PROFILES);
const NOVEMBER = { startDate: "2026-11-01", endDate: "2026-11-30" };
const EVERYTHING = { startDate: "2026-01-01", endDate: "2026-12-31" };
const NOTHING = { startDate: "2025-01-01", endDate: "2025-01-31" };

pinEndpoint(
  "/api/reports/timesheet",
  [
    {
      name: "all jobseekers, 25 Oct to 14 Nov",
      body: {
        jobseekerIds: allProfiles,
        weekPeriods: [{ start: "2026-10-25", end: "2026-11-14" }],
      },
    },
    {
      name: "one week only",
      body: {
        jobseekerIds: allProfiles,
        weekPeriods: [{ start: "2026-11-01", end: "2026-11-07" }],
      },
    },
    {
      name: "two separate periods",
      body: {
        jobseekerIds: allProfiles,
        weekPeriods: [
          { start: "2026-09-20", end: "2026-09-26" },
          { start: "2026-11-08", end: "2026-11-14" },
        ],
      },
    },
    {
      name: "one client",
      body: {
        jobseekerIds: allProfiles,
        clientIds: [CLIENTS.northwind],
        weekPeriods: [{ start: "2026-10-25", end: "2026-11-14" }],
      },
    },
    {
      name: "one jobseeker (hybrid, two rows)",
      body: {
        jobseekerIds: [PROFILES.hybrid],
        weekPeriods: [{ start: "2026-11-01", end: "2026-11-07" }],
      },
    },
    {
      name: "pay cycle filter",
      body: {
        jobseekerIds: allProfiles,
        payCycles: ["Biweekly - 2 week hold"],
        weekPeriods: [{ start: "2026-10-25", end: "2026-11-14" }],
      },
    },
    {
      name: "list name filter",
      body: {
        jobseekerIds: allProfiles,
        listNames: ["Pacific Warehousing"],
        weekPeriods: [{ start: "2026-10-25", end: "2026-11-14" }],
      },
    },
    {
      name: "a period with no timesheets",
      body: {
        jobseekerIds: allProfiles,
        weekPeriods: [{ start: "2025-01-05", end: "2025-01-11" }],
      },
    },
    { name: "no body", body: {}, status: 400 },
    {
      name: "a period without dates",
      body: { jobseekerIds: allProfiles, weekPeriods: [{}] },
      status: 400,
    },
  ],
  { tiesBy: "week_start_date" }
);

pinEndpoint("/api/reports/margin", [
  { name: "november", body: NOVEMBER },
  { name: "the whole year", body: EVERYTHING },
  { name: "a month with no invoices", body: NOTHING },
  { name: "no dates", body: {}, status: 400 },
]);

pinEndpoint("/api/reports/invoice", [
  { name: "the whole year", body: EVERYTHING },
  { name: "november", body: NOVEMBER },
  {
    name: "two clients",
    body: { ...EVERYTHING, clientIds: [CLIENTS.northwind, CLIENTS.prairie] },
  },
  { name: "a month with no invoices", body: NOTHING },
  { name: "no dates", body: {}, status: 400 },
]);

pinEndpoint("/api/reports/deduction", [
  { name: "november (one invoice has a deduction line)", body: NOVEMBER },
  { name: "the whole year", body: EVERYTHING },
  { name: "a month with no invoices", body: NOTHING },
  { name: "no dates", body: {}, status: 400 },
]);

pinEndpoint(
  "/api/reports/rate-list",
  [
    { name: "all clients", body: {} },
    { name: "one client", body: { clientIds: [CLIENTS.quebec] } },
    {
      name: "a client that does not exist",
      body: { clientIds: ["00000000-0000-4000-8000-0000000000ff"] },
    },
  ],
  { tiesBy: "client_name" }
);

pinEndpoint("/api/reports/clients", [
  { name: "all clients", body: {} },
  { name: "payment method filter", body: { paymentMethods: ["Cheque"] } },
  { name: "terms filter", body: { terms: ["Net 15", "Net 45"] } },
  {
    name: "client manager filter",
    body: { clientManagerIds: ["Test Recruiter Manager"] },
  },
  { name: "filters that match nothing", body: { paymentMethods: ["Cash"] } },
]);

pinEndpoint("/api/reports/sales", [
  {
    name: "all clients, the whole year",
    body: { clientIds: allClients, ...EVERYTHING },
  },
  { name: "all clients, no dates", body: { clientIds: allClients } },
  {
    name: "one client, november",
    body: { clientIds: [CLIENTS.northwind], ...NOVEMBER },
  },
  {
    name: "one jobseeker",
    body: { clientIds: allClients, jobseekerIds: [PROFILES.hybrid] },
  },
  {
    name: "a sales person",
    body: { clientIds: allClients, salesPersons: ["Test Sales"] },
  },
  {
    name: "a sales person that matches nothing",
    body: { clientIds: allClients, salesPersons: ["Nobody"] },
  },
  { name: "no clients given", body: { ...EVERYTHING } },
]);

const ENVELOPE_RANGE = { startDate: "2026-10-25", endDate: "2026-11-14" };

pinEndpoint(
  "/api/reports/envelope-printing-position",
  [
    {
      name: "all clients, 25 Oct to 14 Nov",
      body: { clientIds: allClients, ...ENVELOPE_RANGE },
    },
    { name: "all clients, no dates", body: { clientIds: allClients } },
    {
      name: "one client (weekly, one week hold)",
      body: { clientIds: [CLIENTS.northwind], ...ENVELOPE_RANGE },
    },
    {
      name: "the biweekly client",
      body: { clientIds: [CLIENTS.quebec], ...ENVELOPE_RANGE },
    },
    {
      name: "list name filter",
      body: {
        clientIds: allClients,
        ...ENVELOPE_RANGE,
        listName: "Pacific Warehousing",
      },
    },
    {
      name: "list names as a list",
      body: {
        clientIds: allClients,
        ...ENVELOPE_RANGE,
        listName: ["Northwind", "Prairie Foods"],
      },
    },
    {
      name: "pay cycle filter",
      body: {
        clientIds: allClients,
        ...ENVELOPE_RANGE,
        payCycle: "Weekly - 2 week hold",
      },
    },
    {
      name: "a client that does not exist",
      body: { clientIds: ["00000000-0000-4000-8000-0000000000ff"] },
    },
    { name: "no clients", body: {}, status: 400 },
  ],
  { tiesBy: "week_ending" }
);

pinEndpoint(
  "/api/reports/envelope-printing-by-due-date",
  [
    {
      name: "all clients, due 13 Nov",
      body: { clientIds: allClients, dueDate: "2026-11-13" },
    },
    {
      name: "all clients, due 20 Nov",
      body: { clientIds: allClients, dueDate: "2026-11-20" },
    },
    {
      name: "all clients, due 20 Nov (Pacific, two week hold) ",
      body: { clientIds: [CLIENTS.pacific], dueDate: "2026-11-20" },
    },
    {
      name: "all clients, due 27 Nov",
      body: { clientIds: allClients, dueDate: "2026-11-27" },
    },
    {
      name: "all clients, due 4 Dec",
      body: { clientIds: allClients, dueDate: "2026-12-04" },
    },
    { name: "all clients, no due date", body: { clientIds: allClients } },
    {
      name: "pay cycle filter",
      body: { clientIds: allClients, payCycle: ["Biweekly - 2 week hold"] },
    },
    {
      name: "a due date nothing falls on",
      body: { clientIds: allClients, dueDate: "2026-11-14" },
    },
    { name: "no clients", body: {}, status: 400 },
  ],
  { tiesBy: "week_ending" }
);
