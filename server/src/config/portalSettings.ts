/**
 * Registry of per-portal settings: values that differ between portals (company
 * details on invoices, training videos, ...) and used to be typed into the code.
 *
 * - The code is the source of truth for WHICH settings exist and their defaults.
 * - The `portal_settings` table (one per portal database) stores only this
 *   portal's own values.
 * - A setting's value is: the database value if set, otherwise the environment
 *   variable named in `envFallback` (if any and set), otherwise `defaultValue`.
 *   Environment variables are deleted once nothing falls back to them any more.
 *
 * To add a setting: add an entry here, read it with `getPortalSetting(key)` on the
 * server or `usePortalSetting(key)` on the client. Never rename a key once in use.
 */

export type PortalSettingGroup =
  | "portal"
  | "email"
  | "company"
  | "branding"
  | "switcher"
  | "access"
  | "legal"
  | "training";

export interface PortalSettingDefinition {
  /** Stable identifier stored in the database. */
  key: string;
  group: PortalSettingGroup;
  label: string;
  description?: string;
  /** Used when neither the database nor the environment has a value. */
  defaultValue: string;
  /** Name of an environment variable to use before the default. */
  envFallback?: string;
  /** Show a larger text box on the settings page. */
  multiline?: boolean;
  /**
   * Safe to send to visitors who are not logged in (for example the company name
   * on the public Privacy Policy). Never set this on anything private.
   */
  public?: boolean;
}

export const PORTAL_SETTINGS: ReadonlyArray<PortalSettingDefinition> = [
  {
    key: "portal.name",
    group: "portal",
    label: "Portal name",
    description:
      "Name used in email sender names, welcome emails, signup metadata and support tickets.",
    defaultValue: "Ops Portal",
    envFallback: "PORTAL_NAME",
  },
  {
    key: "email.noReplyFrom",
    group: "email",
    label: "No-reply sender address",
    description:
      "From address of automated emails (confirmations, invoices, ...).",
    defaultValue: "",
    envFallback: "NO_REPLY_FROM_EMAIL",
  },
  {
    key: "email.assignmentFrom",
    group: "email",
    label: "Assignment email sender address",
    description:
      "From address of the jobseeker assignment and removal emails. Falls back to the no-reply address.",
    defaultValue: "",
    envFallback: "ASSIGNMENT_FROM_EMAIL",
  },
  {
    key: "email.defaultFrom",
    group: "email",
    label: "Default sender address",
    description: "Used when no other sender address is set.",
    defaultValue: "",
    envFallback: "DEFAULT_FROM_EMAIL",
  },
  {
    key: "email.invoiceCc",
    group: "email",
    label: "Invoice email CC addresses",
    description: "Comma-separated addresses copied on every invoice email.",
    defaultValue: "",
    envFallback: "INVOICE_CC_EMAILS",
  },
  {
    key: "email.supportNotifyTo",
    group: "email",
    label: "Support ticket notification addresses",
    description:
      "Comma-separated addresses notified about support tickets. Empty means no notification.",
    defaultValue: "",
    envFallback: "SUPPORT_NOTIFY_TO",
  },
  {
    key: "email.supportNotifyCc",
    group: "email",
    label: "Support ticket notification CC",
    description:
      "Comma-separated addresses copied on support ticket notifications.",
    defaultValue: "",
    envFallback: "SUPPORT_NOTIFY_CC",
  },
  {
    key: "company.name",
    group: "company",
    label: "Company name",
    description: "Legal company name printed at the top of invoices.",
    defaultValue: "Rhythence Group",
  },
  {
    key: "company.address",
    group: "company",
    label: "Address line 1",
    description: "Street address printed on invoices.",
    defaultValue: "240 Humberline Dr",
  },
  {
    key: "company.address2",
    group: "company",
    label: "Address line 2",
    description: "City, province and postal code printed on invoices.",
    defaultValue: "Etobicoke ON, M9W 5X1",
  },
  {
    key: "company.taxNumber",
    group: "company",
    label: "Tax number",
    description: "GST/HST number printed on invoices, with its label.",
    defaultValue: "GST/HST No. 825183387",
  },
  {
    key: "branding.aiChatTitle",
    group: "branding",
    label: "AI chat page title",
    description: "Title shown on the AI chat page.",
    defaultValue: "Rhythence AI Chat",
  },
  {
    key: "branding.brandName",
    group: "branding",
    label: "Brand name",
    description:
      "Short brand name used in headings, the browser tab title, dashboard subtitles, the AI chat and logo descriptions.",
    defaultValue: "Rhythence",
    public: true,
  },
  {
    key: "switcher.currentLogo",
    group: "switcher",
    label: "Portal switcher: this portal's icon",
    description:
      "Icon shown for this portal in the portal switcher: godspeed, canhire, allstaff or hdgroup. Leave empty (with no other portals below) to hide the switcher.",
    defaultValue: "",
    public: true,
  },
  {
    key: "switcher.options",
    group: "switcher",
    label: "Portal switcher: other portals",
    description:
      "One portal per line as: Name | https://address | icon (godspeed, canhire, allstaff or hdgroup). Leave empty to hide the switcher.",
    defaultValue: "",
    multiline: true,
    public: true,
  },
  {
    key: "access.staffEmailContains",
    group: "access",
    label: "Staff email: contains",
    description:
      "Comma-separated text. A sign-up or login whose email contains any of these (for example @company.com) is treated as staff (recruiter/admin side). Empty means nobody is recognised by email.",
    defaultValue: "",
  },
  {
    key: "access.staffEmailExcluded",
    group: "access",
    label: "Staff email: never staff",
    description:
      "Comma-separated exact emails that are never treated as staff.",
    defaultValue: "",
  },
  {
    key: "legal.companyName",
    group: "legal",
    label: "Legal company name",
    description:
      "Full company name at the top and in the contact block of the Privacy Policy and Terms of Service.",
    defaultValue: "Rhythence Group",
    public: true,
  },
  {
    key: "legal.companyShortName",
    group: "legal",
    label: "Short company name",
    description:
      "Name used inside the sentences of the Privacy Policy and Terms of Service.",
    defaultValue: "Rhythence Group",
    public: true,
  },
  {
    key: "legal.contactAddress",
    group: "legal",
    label: "Contact address",
    description:
      "Address in the Contact section of the legal pages. Leave all three contact fields empty to hide the section.",
    defaultValue: "",
    public: true,
  },
  {
    key: "legal.contactEmail",
    group: "legal",
    label: "Contact email",
    description: "Email address in the Contact section of the legal pages.",
    defaultValue: "",
    public: true,
  },
  {
    key: "legal.contactPhone",
    group: "legal",
    label: "Contact phone",
    description: "Phone number in the Contact section of the legal pages.",
    defaultValue: "",
    public: true,
  },
  {
    key: "training.video1",
    group: "training",
    label: "Training video 1 (YouTube ID)",
    description: "YouTube video ID of the first mandatory training module.",
    defaultValue: "3uXKmNbTZos",
  },
  {
    key: "training.video2",
    group: "training",
    label: "Training video 2 (YouTube ID)",
    description: "YouTube video ID of the second mandatory training module.",
    defaultValue: "O615tiZ6eOk",
  },
];

const SETTING_BY_KEY = new Map(PORTAL_SETTINGS.map((s) => [s.key, s]));

export function getPortalSettingDefinition(
  key: string
): PortalSettingDefinition | undefined {
  return SETTING_BY_KEY.get(key);
}
