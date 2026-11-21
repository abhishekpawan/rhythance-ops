// After sign-in, once the first page is on screen and the browser has nothing else to do, the code of the other
// pages this person can open is fetched in the background, one page at a time, so that moving between pages does
// not wait for a download. The pages come from the same role lists as the routes in App.tsx, and are fetched
// with the very `import()` the page itself uses (lazyPages.ts). Nothing is drawn and nothing is called on the API.
import type { User } from "@supabase/supabase-js";
import * as roles from "../constants/accessControl";
import { hasAnyExactAccessRole, type AccessRole } from "../lib/auth";
import * as p from "./lazyPages";

const START_AFTER_MS = 1000; // let the page that was just opened finish its own downloads first
const everyone = [
  p.Dashboard,
  p.UserProfile,
  p.OnboardingConsent,
  p.TrainingModules,
  p.TermsOfService,
  p.PrivacyPolicy,
];
const byRole: [AccessRole[], object[]][] = [
  [roles.AI_CHAT_ROLES, [p.GodspeedAIChat]],
  [roles.CALENDAR_ROLES, [p.CalendarPage]],
  [roles.ALL_USERS_ROLES, [p.AllUsersManagement]],
  [roles.JOBSEEKER_CREATE_ROLES, [p.ProfileCreate, p.ProfileEdit]],
  [
    roles.JOBSEEKER_MANAGEMENT_CREATE_ROLES,
    [p.ProfileAccountCreated, p.ProfileSuccess],
  ],
  [["jobseeker", ...roles.JOBSEEKER_LIST_ROLES], [p.JobSeekerProfile]],
  [roles.JOBSEEKER_LIST_ROLES, [p.JobSeekerManagement]],
  [roles.SIN_WORK_PERMIT_ROLES, [p.SinWorkPermitManagement]],
  [
    roles.JOBSEEKER_DRAFT_ROLES,
    [p.JobseekerDrafts, p.JobseekerProfileDraftEdit],
  ],
  [roles.CLIENT_LIST_ROLES, [p.ClientManagement, p.ClientView]],
  [roles.CLIENT_CREATE_ROLES, [p.ClientCreate, p.ClientEdit]],
  [roles.CLIENT_DRAFT_ROLES, [p.ClientDrafts, p.ClientDraftEdit]],
  [roles.POSITION_LIST_ROLES, [p.PositionManagement, p.PositionView]],
  [roles.POSITION_CREATE_ROLES, [p.PositionCreate, p.PositionEdit]],
  [roles.POSITION_DRAFT_ROLES, [p.PositionDrafts, p.PositionDraftEdit]],
  [roles.POSITION_MATCHING_ROLES, [p.PositionMatching]],
  [roles.TIMESHEET_MANAGEMENT_ROLES, [p.TimesheetManagement]],
  [
    roles.BULK_TIMESHEET_ROLES,
    [
      p.BulkTimesheetManagement,
      p.BulkTimesheetJobseekerManagement,
      p.TimesheetList,
      p.TimesheetView,
    ],
  ],
  [
    roles.INVOICE_MANAGEMENT_ROLES,
    [p.InvoiceManagement, p.InvoiceList, p.InvoiceView],
  ],
  [
    roles.REPORTS_ROLES,
    [
      p.Reports,
      p.WeeklyTimesheet,
      p.MarginReport,
      p.RateList,
      p.DeductionReport,
      p.InvoiceReport,
      p.ClientsReport,
      p.SalesReport,
      p.EnvelopePrintingReport,
      p.EnvelopePrintingByDueDateReport,
    ],
  ],
  [roles.RECRUITER_HIERARCHY_ROLES, [p.RecruiterHierarchy]],
  [roles.CONSENT_LIST_ROLES, [p.ConsentListPage, p.ConsentDetailPage]],
  [roles.CONSENT_CREATE_ROLES, [p.CreateConsentPage]],
  [roles.DROPDOWN_OPTIONS_ROLES, [p.DropdownOptionsManagement]],
  [roles.INVITE_INTERNAL_USER_ROLES, [p.InviteRecruiter]],
  [roles.SUPPORT_ROLES, [p.SupportList, p.SupportNew, p.SupportTicketPage]],
  [
    ["jobseeker"],
    [
      p.ProfileVerificationPending,
      p.ProfileVerificationRejected,
      p.JobSeekerPositions,
    ],
  ],
];
const superAdminOnly = [
  p.ConsentTemplatePage,
  p.EmailTemplatePreviewPage,
  p.FeatureFlagsPage,
  p.PortalSettingsPage,
];

/** The pages this person's routes in App.tsx let them open (not the sign-in pages: nobody is signed in there). */
export function pagesFor(user: User | null, isSuperAdmin: boolean): object[] {
  const pages = new Set<object>(everyone);
  for (const [allowed, list] of byRole)
    if (hasAnyExactAccessRole(user, allowed))
      list.forEach((page) => pages.add(page));
  if (isSuperAdmin) superAdminOnly.forEach((page) => pages.add(page));
  return [...pages];
}

let fetching = false;
/** True while a background fetch is running: reloadOnStaleChunk must not reload the page for its failure. */
export const isPrefetching = () => fetching;

const whenIdle = (run: () => void) =>
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(run, { timeout: 5000 })
    : window.setTimeout(run, 200);

/**
 * Fetches `pages` one at a time, each when the browser is idle. Skipped when the person asked their browser to
 * save data. A page that fails to download (an old tab after a deploy, a lost connection) stops the rest and is
 * ignored: it will be asked for again, and handled, when the person really opens it. Returns the cancel function.
 */
export function startPrefetch(pages: object[], load = p.loadPage) {
  const saveData = (navigator as { connection?: { saveData?: boolean } })
    .connection?.saveData;
  if (saveData || pages.length === 0) return () => undefined;
  let cancelled = false;
  let next = 0;
  const step = () => {
    if (cancelled || next >= pages.length) return;
    fetching = true;
    load(pages[next++])
      .then(
        () => whenIdle(step),
        () => undefined
      )
      .finally(() => (fetching = false));
  };
  const timer = window.setTimeout(() => whenIdle(step), START_AFTER_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
