// Fixed identities of the synthetic test data. Nothing here is real: addresses end in @example.test,
// phones are +1 555 numbers, the password is the same throwaway value for every test account on the
// local test database (which only ever runs on this machine).

export const PASSWORD = "Test-Passw0rd!";

/** The fixed clock the server and the date-based answers use: 10:00 on Tuesday 17 November 2026 in Toronto. */
export const FIXED_NOW = "2026-11-17T15:00:00.000Z";

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * One account per role (the eight roles of docs/role-access-control.md, plus a super admin).
 * user_type and user_role are written to app_metadata, where the server and the database read them.
 */
export const STAFF = {
  admin: {
    id: uid(1),
    email: "admin@example.test",
    name: "Test Admin",
    userType: "admin",
    userRole: [],
  },
  superadmin: {
    id: uid(2),
    email: "superadmin@example.test",
    name: "Test Super Admin",
    userType: "admin",
    userRole: ["superadmin"],
  },
  recruiter: {
    id: uid(3),
    email: "recruiter@example.test",
    name: "Test Recruiter",
    userType: "recruiter",
    userRole: ["recruiter"],
  },
  bookkeeper: {
    id: uid(4),
    email: "bookkeeper@example.test",
    name: "Test Bookkeeper",
    userType: "recruiter",
    userRole: ["bookkeeper"],
  },
  recruiter_manager: {
    id: uid(5),
    email: "recruiter.manager@example.test",
    name: "Test Recruiter Manager",
    userType: "recruiter",
    userRole: ["recruiter_manager"],
  },
  accountant_manager: {
    id: uid(6),
    email: "accountant.manager@example.test",
    name: "Test Accountant Manager",
    userType: "recruiter",
    userRole: ["accountant_manager"],
  },
  sales: {
    id: uid(7),
    email: "sales@example.test",
    name: "Test Sales",
    userType: "recruiter",
    userRole: ["sales"],
  },
  recruiter_director: {
    id: uid(8),
    email: "recruiter.director@example.test",
    name: "Test Recruiter Director",
    userType: "recruiter",
    userRole: ["recruiter_director"],
  },
};

/** Jobseekers made by the server's admin path (role in app_metadata); each has a profile in the data file. */
export const JOBSEEKERS = {
  sin: {
    id: uid(11),
    email: "jobseeker.sin@example.test",
    name: "Sam Sinclair",
    mobile: "+15555550111",
  },
  cash: {
    id: uid(12),
    email: "jobseeker.cash@example.test",
    name: "Casey Cashman",
    mobile: "+15555550112",
  },
  hybrid: {
    id: uid(13),
    email: "jobseeker.hybrid@example.test",
    name: "Hana Hybrid",
    mobile: "+15555550113",
  },
  corp: {
    id: uid(14),
    email: "jobseeker.corp@example.test",
    name: "Corey Corporate",
    mobile: "+15555550114",
  },
  hybridEt: {
    id: uid(15),
    email: "jobseeker.hybrid.et@example.test",
    name: "Ely Etransfer",
    mobile: "+15555550115",
  },
};

/** Made through open sign-up (the anon key), so the 034 trigger gives it the jobseeker role. No profile. */
export const SIGNUP_JOBSEEKER = {
  email: "jobseeker.signup@example.test",
  name: "Sunny Signup",
  mobile: "+15555550199",
};

/**
 * Support tickets of the seed (tests/seed/data.sql): fixed ids, ticket numbers 1 to 5 (the sequence hands them out in
 * insert order), fixed dates. Tickets made by a test at run time get the next numbers.
 * owner: who raised it. The messages and attachments are listed under `messages` and `attachments`.
 */
export const SUPPORT = {
  /** in progress, raised by the recruiter: agent reply, internal note, two files (one on the internal note) */
  recruiterBug: { id: uid(1001), number: 1 },
  /** resolved, raised by the bookkeeper */
  bookkeeperQuestion: { id: uid(1002), number: 2 },
  /** waiting on the client, raised by the admin */
  adminChange: { id: uid(1003), number: 3 },
  /** closed (confirmed by the client), raised by sales */
  salesFeature: { id: uid(1004), number: 4 },
  /** open and blocked, raised by the accountant manager */
  accountantBug: { id: uid(1005), number: 5 },
};
export const SUPPORT_SEEDED = Object.values(SUPPORT).map((t) => t.id);
/** Files of ticket 1: on the first message (visible to the owner, admins and agents) and on the internal note (agents only). */
export const SUPPORT_ATTACHMENTS = {
  onDescription: { id: uid(1081), ticket: SUPPORT.recruiterBug.id },
  onInternalNote: { id: uid(1082), ticket: SUPPORT.recruiterBug.id },
};

/** Files uploaded by the seed: bucket, object name, owner. */
export const FILES = {
  sinDocument: {
    bucket: "jobseeker-documents",
    name: `${JOBSEEKERS.sin.id}/id-document.pdf`,
  },
  cashDocument: {
    bucket: "jobseeker-documents",
    name: `${JOBSEEKERS.cash.id}/id-document.pdf`,
  },
  // 034: originals stay readable (the public consent page needs them); filled-consents/ is staff only
  signedConsent: {
    bucket: "consent-documents",
    name: `filled-consents/consent-${JOBSEEKERS.sin.id}.pdf`,
  },
  consentOriginal: {
    bucket: "consent-documents",
    name: "originals/test-consent.pdf",
  },
  invoiceFile: {
    bucket: "invoices",
    name: `${STAFF.recruiter.id}/invoice-900001.pdf`,
  },
  // support ticket 1: the two files the seeded attachment rows point to
  supportOnDescription: {
    bucket: "support-attachments",
    name: `${SUPPORT.recruiterBug.id}/screenshot-error.pdf`,
  },
  supportOnInternalNote: {
    bucket: "support-attachments",
    name: `${SUPPORT.recruiterBug.id}/internal-log.pdf`,
  },
};

export const PORTAL_ID = (n) => uid(n);

/** Ids the Reports pins use (the rows are in tests/seed/data.sql). */
export const CLIENTS = {
  northwind: uid(21),
  quebec: uid(22),
  pacific: uid(23),
  prairie: uid(24),
};
export const PROFILES = {
  sin: uid(41),
  cash: uid(42),
  hybrid: uid(43),
  corp: uid(44),
  hybridEt: uid(45),
};
