import { matchPath } from "react-router-dom";

export interface SupportAreaPage {
  key: string;
  labelKey: string;
  labelEn: string;
  path: string;
}

export interface SupportAreaModule {
  key: string;
  labelKey: string;
  labelEn: string;
  path?: string;
  pages: SupportAreaPage[];
}

export const SUPPORT_MODULES: SupportAreaModule[] = [
  {
    key: "dashboard",
    labelKey: "navigation.dashboard",
    labelEn: "Dashboard",
    path: "/dashboard",
    pages: [],
  },
  {
    key: "calendar",
    labelKey: "navigation.calendar",
    labelEn: "Workforce Schedule Dashboard",
    path: "/calendar",
    pages: [],
  },
  {
    key: "training",
    labelKey: "navigation.training",
    labelEn: "Training",
    path: "/training-modules",
    pages: [],
  },
  {
    key: "aiChat",
    labelKey: "navigation.aiChat",
    labelEn: "AI Chat",
    path: "/ai-chat",
    pages: [],
  },
  {
    key: "userManagement",
    labelKey: "navigation.userManagement",
    labelEn: "User Management",
    pages: [
      {
        key: "allUsers",
        labelKey: "navigation.allUsers",
        labelEn: "All Users",
        path: "/all-users-management",
      },
      {
        key: "recruiterHierarchy",
        labelKey: "navigation.recruiterHierarchy",
        labelEn: "Recruiter Hierarchy",
        path: "/recruiter-hierarchy",
      },
      {
        key: "inviteRecruiter",
        labelKey: "recruiterManagement.inviteRecruiter",
        labelEn: "Invite Recruiter",
        path: "/invite-recruiter",
      },
      {
        key: "dropdownOptions",
        labelKey: "navigation.dropdownOptions",
        labelEn: "Dropdown Options",
        path: "/admin/dropdown-options",
      },
    ],
  },
  {
    key: "jobseekerManagement",
    labelKey: "navigation.jobseekerManagement",
    labelEn: "Jobseeker Management",
    pages: [
      {
        key: "allJobseekers",
        labelKey: "navigation.allJobseekers",
        labelEn: "All Jobseekers",
        path: "/jobseeker-management",
      },
      {
        key: "createJobseeker",
        labelKey: "navigation.createJobseeker",
        labelEn: "Create Jobseeker",
        path: "/profile/create",
      },
      {
        key: "jobseekerDrafts",
        labelKey: "navigation.jobseekerDrafts",
        labelEn: "Jobseeker Drafts",
        path: "/jobseekers/drafts",
      },
      {
        key: "sinWorkPermitManagement",
        labelKey: "navigation.sinWorkPermitManagement",
        labelEn: "SIN & Work Permit Info",
        path: "/sin-work-permit-management",
      },
    ],
  },
  {
    key: "clientManagement",
    labelKey: "navigation.clientManagement",
    labelEn: "Client Management",
    pages: [
      {
        key: "allClients",
        labelKey: "navigation.allClients",
        labelEn: "All Clients",
        path: "/client-management",
      },
      {
        key: "createClient",
        labelKey: "navigation.createClient",
        labelEn: "Create Client",
        path: "/client-management/create",
      },
      {
        key: "draftClients",
        labelKey: "navigation.draftClients",
        labelEn: "Draft Clients",
        path: "/client-management/drafts",
      },
    ],
  },
  {
    key: "positionManagement",
    labelKey: "navigation.positionManagement",
    labelEn: "Position Management",
    pages: [
      {
        key: "allPositions",
        labelKey: "navigation.allPositions",
        labelEn: "All Positions",
        path: "/position-management",
      },
      {
        key: "createPosition",
        labelKey: "navigation.createPosition",
        labelEn: "Create Position",
        path: "/position-management/create",
      },
      {
        key: "createPositionSubcategory",
        labelKey: "navigation.createPositionSubcategory",
        labelEn: "Create Position Subcategory",
        path: "/position-management/create-subcategory",
      },
      {
        key: "draftPositions",
        labelKey: "navigation.draftPositions",
        labelEn: "Draft Positions",
        path: "/position-management/drafts",
      },
      {
        key: "positionMatching",
        labelKey: "navigation.positionMatching",
        labelEn: "Position Matching",
        path: "/position-matching",
      },
    ],
  },
  {
    key: "consentManagement",
    labelKey: "navigation.consentManagement",
    labelEn: "Consent Management",
    pages: [
      {
        key: "allConsentDocuments",
        labelKey: "navigation.allConsentDocuments",
        labelEn: "All Consent Documents",
        path: "/consent-dashboard",
      },
      {
        key: "createConsentDocument",
        labelKey: "navigation.createConsentDocument",
        labelEn: "Create Consent Document",
        path: "/consent-dashboard/new",
      },
      {
        key: "consentTemplates",
        labelKey: "navigation.consentTemplates",
        labelEn: "Consent Templates",
        path: "/consent-dashboard/templates",
      },
    ],
  },
  {
    key: "financial",
    labelKey: "navigation.financial",
    labelEn: "Financial",
    pages: [
      {
        key: "timesheetManagement",
        labelKey: "navigation.timesheetManagement",
        labelEn: "Create Single Timesheet",
        path: "/timesheet-management",
      },
      {
        key: "createBulkTimesheetClient",
        labelKey: "navigation.createBulkTimesheetClient",
        labelEn: "Create Bulk Timesheet (Client)",
        path: "/bulk-timesheet-management",
      },
      {
        key: "createBulkTimesheetJobseeker",
        labelKey: "navigation.createBulkTimesheetJobseeker",
        labelEn: "Create Bulk Timesheet (Job Seeker)",
        path: "/bulk-timesheet-management/jobseeker",
      },
      {
        key: "bulkTimesheetList",
        labelKey: "navigation.bulkTimesheetList",
        labelEn: "All Timesheet Lists",
        path: "/timesheet-management/list",
      },
      {
        key: "invoiceManagement",
        labelKey: "navigation.invoiceManagement",
        labelEn: "Create Client Invoices",
        path: "/invoice-management",
      },
      {
        key: "invoiceList",
        labelKey: "navigation.invoiceList",
        labelEn: "Client Invoices List",
        path: "/invoice-management/list",
      },
    ],
  },
  {
    key: "reportsAnalytics",
    labelKey: "navigation.reportsAnalytics",
    labelEn: "Reports & Analytics",
    pages: [
      {
        key: "reports",
        labelKey: "navigation.reports",
        labelEn: "Reports",
        path: "/reports",
      },
    ],
  },
  {
    key: "account",
    labelKey: "support.area.account",
    labelEn: "Logging in / My Account",
    pages: [
      {
        key: "myAccount",
        labelKey: "navigation.myAccount",
        labelEn: "My Account",
        path: "/profile",
      },
      {
        key: "login",
        labelKey: "support.area.login",
        labelEn: "Login",
        path: "/login",
      },
    ],
  },
  {
    key: "other",
    labelKey: "support.area.other",
    labelEn: "Something else",
    pages: [],
  },
];

/**
 * Given a URL or pathname, attempts to match a known module and page using matchPath.
 */
export function matchAreaFromPath(rawPathname: string | null | undefined): {
  moduleKey: string;
  pageKey: string;
  areaKey: string;
  areaLabel: string;
} | null {
  if (!rawPathname) return null;

  // Extract just pathname
  let pathname = rawPathname.trim();
  try {
    if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
      pathname = new URL(pathname).pathname;
    }
  } catch {
    // If not a valid absolute URL, strip query and hash
    pathname = pathname.split("?")[0].split("#")[0];
  }

  pathname = pathname.split("?")[0].split("#")[0];
  if (!pathname.startsWith("/")) {
    pathname = "/" + pathname;
  }

  // First check subpages
  for (const mod of SUPPORT_MODULES) {
    for (const page of mod.pages) {
      if (
        matchPath({ path: page.path, end: true }, pathname) ||
        matchPath({ path: `${page.path}/*`, end: false }, pathname)
      ) {
        return {
          moduleKey: mod.key,
          pageKey: page.key,
          areaKey: `${mod.key}.${page.key}`,
          areaLabel: `${mod.labelEn} > ${page.labelEn}`,
        };
      }
    }

    // Check module-level path if pages is empty
    if (mod.path && (matchPath({ path: mod.path, end: true }, pathname) || matchPath({ path: `${mod.path}/*`, end: false }, pathname))) {
      return {
        moduleKey: mod.key,
        pageKey: "",
        areaKey: mod.key,
        areaLabel: mod.labelEn,
      };
    }
  }

  return null;
}
