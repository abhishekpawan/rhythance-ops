// The pages of the app, each loaded the first time its route is opened (React.lazy), so the sign-in screen
// does not download every other page. Sign-in, password reset, the second sign-in step and the e-mailed
// consent page are imported directly in App.tsx. App.tsx wraps its routes in one <Suspense>.
import { lazy, type ComponentType } from "react";

// the loader of each page, so its code can be fetched ahead of the first visit (prefetchPages.ts)
const loaders = new Map<object, () => Promise<unknown>>();
export const loadPage = (c: object) => loaders.get(c)?.() ?? Promise.resolve();

/** A page exported by name from its module, loaded on first render (its props stay typed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pages have different props
const page = <Name extends string, Page extends ComponentType<any>>(
  load: () => Promise<Record<Name, Page>>,
  name: Name
) => {
  const component = lazy(() => load().then((m) => ({ default: m[name] })));
  loaders.set(component, load);
  return component;
};

export const Signup = page(
  () => import("../pages/Authentication/Signup"),
  "Signup"
);
export const VerificationPending = page(
  () => import("../pages/Authentication/VerificationPending"),
  "VerificationPending"
);
export const EmailConfirmed = page(
  () => import("../pages/Authentication/EmailConfirmed"),
  "EmailConfirmed"
);
export const CompleteSignup = page(
  () => import("../pages/Authentication/CompleteSignup"),
  "CompleteSignup"
);
export const ProfileVerificationPending = page(
  () => import("../pages/JobseekerManagement/ProfileVerificationPending"),
  "ProfileVerificationPending"
);
export const ProfileVerificationRejected = page(
  () => import("../pages/JobseekerManagement/ProfileVerificationRejected"),
  "ProfileVerificationRejected"
);
export const ForgotPassword = page(
  () => import("../pages/Authentication/ForgotPassword"),
  "ForgotPassword"
);
export const ProfileCreate = page(
  () => import("../pages/JobseekerProfile/ProfileCreate"),
  "ProfileCreate"
);
export const ProfileAccountCreated = page(
  () => import("../pages/JobseekerProfile/ProfileAccountCreated"),
  "ProfileAccountCreated"
);
export const ProfileSuccess = page(
  () => import("../pages/JobseekerProfile/ProfileSuccess"),
  "ProfileSuccess"
);
export const JobSeekerProfile = page(
  () => import("../pages/JobseekerManagement/JobSeekerProfile"),
  "JobSeekerProfile"
);
export const ProfileEdit = page(
  () => import("../pages/JobseekerProfile/ProfileEdit"),
  "ProfileEdit"
);
export const ClientCreate = page(
  () => import("../pages/ClientManagement/ClientCreate"),
  "ClientCreate"
);
export const ClientEdit = page(
  () => import("../pages/ClientManagement/ClientEdit"),
  "ClientEdit"
);
export const ClientDrafts = page(
  () => import("../pages/ClientManagement/ClientDrafts"),
  "ClientDrafts"
);
export const ClientDraftEdit = page(
  () => import("../pages/ClientManagement/ClientDraftEdit"),
  "ClientDraftEdit"
);
export const ClientView = page(
  () => import("../pages/ClientManagement/ClientView"),
  "ClientView"
);
export const JobSeekerManagement = page(
  () => import("../pages/JobseekerManagement/JobSeekerManagement"),
  "JobSeekerManagement"
);
export const SinWorkPermitManagement = page(
  () => import("../pages/JobseekerManagement/SinWorkPermitManagement"),
  "SinWorkPermitManagement"
);
export const PositionManagement = page(
  () => import("../pages/PositionManagement/PositionManagement"),
  "PositionManagement"
);
export const PositionCreate = page(
  () => import("../pages/PositionManagement/PositionCreate"),
  "PositionCreate"
);
export const PositionEdit = page(
  () => import("../pages/PositionManagement/PositionEdit"),
  "PositionEdit"
);
export const PositionDrafts = page(
  () => import("../pages/PositionManagement/PositionDrafts"),
  "PositionDrafts"
);
export const PositionDraftEdit = page(
  () => import("../pages/PositionManagement/PositionDraftEdit"),
  "PositionDraftEdit"
);
export const PositionView = page(
  () => import("../pages/PositionManagement/PositionView"),
  "PositionView"
);
export const PositionMatching = page(
  () => import("../pages/PositionManagement/PositionMatching"),
  "PositionMatching"
);
export const JobseekerDrafts = page(
  () => import("../pages/JobseekerProfile/JobseekerDrafts"),
  "JobseekerDrafts"
);
export const JobseekerProfileDraftEdit = page(
  () => import("../pages/JobseekerProfile/JobseekerProfileDraftEdit"),
  "JobseekerProfileDraftEdit"
);
export const TrainingModules = page(
  () => import("../pages/TrainingModules"),
  "TrainingModules"
);
export const UserProfile = page(
  () => import("../pages/UserProfile"),
  "UserProfile"
);
export const JobSeekerPositions = page(
  () => import("../pages/JobseekerManagement/JobSeekerPositions"),
  "JobSeekerPositions"
);
export const TimesheetManagement = page(
  () => import("../pages/TimesheetManagement/TimesheetManagement"),
  "TimesheetManagement"
);
export const TimesheetView = page(
  () => import("../pages/TimesheetManagement/TimesheetView"),
  "TimesheetView"
);
export const ClientManagement = page(
  () => import("../pages/ClientManagement/ClientManagement"),
  "ClientManagement"
);
export const InvoiceManagement = page(
  () => import("../pages/InvoiceManagement/InvoiceManagement"),
  "InvoiceManagement"
);
export const InvoiceList = page(
  () => import("../pages/InvoiceManagement/InvoiceList"),
  "InvoiceList"
);
export const InvoiceView = page(
  () => import("../pages/InvoiceManagement/InvoiceView"),
  "InvoiceView"
);
export const AllUsersManagement = page(
  () => import("../pages/AllUsersManagement"),
  "AllUsersManagement"
);
export const Reports = page(
  () => import("../pages/Reports/Reports"),
  "Reports"
);
export const WeeklyTimesheet = page(
  () => import("../pages/Reports/WeeklyTimesheet"),
  "WeeklyTimesheet"
);
export const MarginReport = page(
  () => import("../pages/Reports/MarginReport"),
  "MarginReport"
);
export const RateList = page(
  () => import("../pages/Reports/RateList"),
  "RateList"
);
export const DeductionReport = page(
  () => import("../pages/Reports/DeductionReport"),
  "DeductionReport"
);
export const InvoiceReport = page(
  () => import("../pages/Reports/InvoiceReport"),
  "InvoiceReport"
);
export const ClientsReport = page(
  () => import("../pages/Reports/ClientsReport"),
  "ClientsReport"
);
export const SalesReport = page(
  () => import("../pages/Reports/SalesReport"),
  "SalesReport"
);
export const EnvelopePrintingReport = page(
  () => import("../pages/Reports/EnvelopePrintingReport"),
  "EnvelopePrintingReport"
);
export const EnvelopePrintingByDueDateReport = page(
  () => import("../pages/Reports/EnvelopePrintingByDueDateReport"),
  "EnvelopePrintingByDueDateReport"
);
export const Dashboard = page(
  () => import("../pages/Dashboard/Dashboard"),
  "Dashboard"
);
export const BulkTimesheetManagement = page(
  () => import("../pages/TimesheetManagement/BulkTimesheetManagement"),
  "BulkTimesheetManagement"
);
export const BulkTimesheetJobseekerManagement = page(
  () => import("../pages/TimesheetManagement/BulkTimesheetJobseekerManagement"),
  "BulkTimesheetJobseekerManagement"
);
export const TimesheetList = page(
  () => import("../pages/TimesheetManagement/TimesheetList"),
  "TimesheetList"
);
export const GodspeedAIChat = page(
  () => import("../pages/GodspeedAIChat"),
  "GodspeedAIChat"
);
export const RecruiterHierarchy = page(
  () => import("../pages/RecruiterHierarchy"),
  "RecruiterHierarchy"
);
export const InviteRecruiter = page(
  () => import("../pages/RecruiterManagement/InviteRecruiter"),
  "InviteRecruiter"
);
export const DropdownOptionsManagement = page(
  () => import("../pages/Admin/DropdownOptionsManagement"),
  "DropdownOptionsManagement"
);
export const CalendarPage = page(
  () => import("../pages/Calendar/CalendarPage"),
  "CalendarPage"
);
export const ConsentListPage = page(
  () => import("../pages/Consent/ConsentListPage"),
  "ConsentListPage"
);
export const CreateConsentPage = page(
  () => import("../pages/Consent/CreateConsentPage"),
  "CreateConsentPage"
);
export const ConsentDetailPage = page(
  () => import("../pages/Consent/ConsentDetailPage"),
  "ConsentDetailPage"
);
export const ConsentTemplatePage = page(
  () => import("../pages/Consent/ConsentTemplatePage"),
  "ConsentTemplatePage"
);
export const EmailTemplatePreviewPage = page(
  () => import("../pages/EmailTemplatePreview/EmailTemplatePreviewPage"),
  "EmailTemplatePreviewPage"
);
export const FeatureFlagsPage = page(
  () => import("../pages/Admin/FeatureFlagsPage"),
  "FeatureFlagsPage"
);
export const PortalSettingsPage = page(
  () => import("../pages/Admin/PortalSettingsPage"),
  "PortalSettingsPage"
);
export const OnboardingConsent = page(
  () => import("../pages/Consent/OnboardingConsent"),
  "OnboardingConsent"
);
export const TermsOfService = page(
  () => import("../pages/Legal/TermsOfService"),
  "TermsOfService"
);
export const PrivacyPolicy = page(
  () => import("../pages/Legal/PrivacyPolicy"),
  "PrivacyPolicy"
);
export const SupportList = page(
  () => import("../pages/Support/SupportList"),
  "SupportList"
);
export const SupportNew = page(
  () => import("../pages/Support/SupportNew"),
  "SupportNew"
);
export const SupportTicketPage = page(
  () => import("../pages/Support/SupportTicket"),
  "SupportTicketPage"
);
