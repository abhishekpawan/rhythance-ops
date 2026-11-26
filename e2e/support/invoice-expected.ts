// What the invoice page must send, written by hand (R-5): the people, positions and clients of the seed, and builders
// for the request bodies whose every number the specs pass in. Nothing here works a total out: the cases do, on paper.
import { CLIENT, TAX } from "./invoice-screens";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const FIXED_MS = 1794927600000; // 17 November 2026, 10:00 in Toronto: the clock the journeys stand on

const person = (
  n: number,
  first: string,
  last: string,
  email: string,
  emp: string
) => ({
  firstName: first,
  lastName: last,
  email,
  jobseekerUserId: uid(10 + n),
  jobseekerProfileId: uid(40 + n),
  employeeId: emp,
});
export const PEOPLE = {
  sam: person(1, "Sam", "Sinclair", "jobseeker.sin@example.test", "E-0011"),
  casey: person(2, "Casey", "Cashman", "jobseeker.cash@example.test", "E-0012"),
  hana: person(3, "Hana", "Hybrid", "jobseeker.hybrid@example.test", "E-0013"),
  corey: person(
    4,
    "Corey",
    "Corporate",
    "jobseeker.corp@example.test",
    "E-0014"
  ),
  ely: person(
    5,
    "Ely",
    "Etransfer",
    "jobseeker.hybrid.et@example.test",
    "E-0015"
  ),
};
export type Person = (typeof PEOPLE)[keyof typeof PEOPLE];

const position = (n: number, title: string, code: string) => ({
  title,
  positionCode: code,
  positionId: uid(n),
  positionNumber: null as string | null,
});
export const POSITIONS = {
  warehouse: position(31, "Warehouse Associate", "NW001"),
  forklift: position(32, "Forklift Operator", "NW002"),
  driver: position(34, "Driver Helper", "QL001"),
  loader: position(35, "Loader", "PW001"),
  lineCook: position(36, "Line Cook Helper", "PF001"),
};
export type Position = (typeof POSITIONS)[keyof typeof POSITIONS];

export const CLIENTS = {
  northwind: {
    id: CLIENT.northwind,
    companyName: "Northwind Test Staffing Client",
    shortCode: "NW",
    emailAddress1: "nora.north@example.test",
    streetAddress1: "1 Test Street",
    city1: "Toronto",
    province1: "ON",
    postalCode1: "M5V 0A1",
    clientManager: "Test Recruiter Manager",
    accountingPerson: "Test Bookkeeper",
    salesPerson: "Test Sales",
    currency: "CAD",
    terms: "Net 30",
    due: "2026-12-17",
  },
  quebec: {
    id: CLIENT.quebec,
    companyName: "Quebec Test Logistics Client",
    shortCode: "QL",
    emailAddress1: "quentin.quebec@example.test",
    streetAddress1: "2 Test Avenue",
    city1: "Montreal",
    province1: "QC",
    postalCode1: "H2Y 1A1",
    clientManager: "Test Recruiter Manager",
    accountingPerson: "Test Bookkeeper",
    salesPerson: "Test Sales",
    currency: "CAD",
    terms: "Net 15",
    due: "2026-12-02",
  },
  pacific: {
    id: CLIENT.pacific,
    companyName: "Pacific Test Warehousing Client",
    shortCode: "PW",
    emailAddress1: "paige.pacific@example.test",
    streetAddress1: "3 Test Road",
    city1: "Vancouver",
    province1: "BC",
    postalCode1: "V6B 1A1",
    clientManager: "Test Recruiter Manager",
    accountingPerson: "Test Bookkeeper",
    salesPerson: "Test Sales",
    currency: "CAD",
    terms: "Net 30",
    due: "2026-12-17",
  },
  prairie: {
    id: CLIENT.prairie,
    companyName: "Prairie Test Foods Client",
    shortCode: "PF",
    emailAddress1: "pat.prairie@example.test",
    streetAddress1: "4 Test Lane",
    city1: "Calgary",
    province1: "AB",
    postalCode1: "T2P 1A1",
    clientManager: "Test Recruiter Manager",
    accountingPerson: "Test Bookkeeper",
    salesPerson: "Test Sales",
    currency: "USD",
    terms: "Net 45",
    due: "2027-01-01",
  },
};
export type ClientKey = keyof typeof CLIENTS;

/** The words the page puts under "message" and "terms" on a new invoice (portal settings of the test database). */
export const MESSAGE_ON_INVOICE =
  "We appreciate your business and look forward to helping you again soon.";
export const TERMS_ON_INVOICE =
  "Interest is payable at 24% annually after the agreed terms.";

/** One line of an invoice as the page sends it; every number is passed in. */
export interface Line {
  /** hours billed at the regular rate, and at the overtime rate */
  reg: number;
  ot: number;
  /** regular and overtime bill rates */
  rate: number;
  otRate: number;
  /** regular pay rate (without premium) and the overtime pay rate sent */
  pay: number;
  otPay: number;
  /** amounts: the client's bill for the line and the jobseeker's pay */
  bill: number;
  jobPay: number;
  desc: string;
  tax: string;
  person?: Person;
  position?: Position;
  otEnabled?: boolean;
}

/** The line of a new invoice (POST), `from` and `to` being the timesheet dates the page keeps. */
export function createLine(
  i: number,
  l: Line,
  number: string,
  from: string,
  to: string
) {
  return {
    id: `timesheet_${FIXED_MS}_${i}`,
    invoiceNumber: number,
    weekStartDate: from,
    weekEndDate: to,
    totalRegularHours: l.reg,
    totalOvertimeHours: l.ot,
    regularBillRate: l.rate,
    overtimeBillRate: l.otRate,
    regularPayRate: l.pay,
    overtimePayRate: l.otPay,
    totalClientBill: l.bill,
    totalJobseekerPay: l.jobPay,
    overtimeEnabled: l.otEnabled ?? false,
    description: l.desc,
    salesTax: l.tax,
    jobseekerProfile: l.person,
    position: l.position,
  };
}

export interface Totals {
  subtotal: number;
  hst: number;
  gst: number;
  qst: number;
  tax: number;
  grand: number;
  hours: number;
}

/** The body of POST /api/invoices for a new invoice, apart from the lines. */
export function createBody(o: {
  client: ClientKey;
  number: string;
  invoiceDate?: string;
  totals: Totals;
  lines: unknown[];
  notes?: string;
}) {
  const c = CLIENTS[o.client];
  const { currency, terms, due, ...client } = c;
  void terms;
  const t = o.totals;
  return {
    invoiceNumber: o.number,
    clientId: c.id,
    invoiceDate: o.invoiceDate ?? "2026-11-17",
    dueDate: due,
    status: "draft",
    currency,
    paymentTerms: c.terms,
    subtotal: t.subtotal,
    totalTax: t.tax,
    totalHst: t.hst,
    totalGst: t.gst,
    totalQst: t.qst,
    grandTotal: t.grand,
    totalHours: t.hours,
    emailSent: false,
    notes: o.notes ?? "",
    documentGenerated: false,
    invoiceData: {
      client,
      timesheets: o.lines,
      attachments: [],
      supplierPOItems: [
        { id: String(FIXED_MS), selectedOption: "", supplierPoNumber: "" },
      ],
      messageOnInvoice: MESSAGE_ON_INVOICE,
      termsOnInvoice: TERMS_ON_INVOICE,
      document: {
        generated: false,
        filePath: null,
        fileName: null,
        fileSize: null,
        generatedAt: null,
        bucketName: "invoices",
      },
      summary: {
        subtotal: t.subtotal,
        totalTax: t.tax,
        totalHst: t.hst,
        totalGst: t.gst,
        totalQst: t.qst,
        grandTotal: t.grand,
        totalHours: t.hours,
        currency,
      },
    },
  };
}

export { TAX };
