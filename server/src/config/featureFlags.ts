/**
 * Feature flag registry: the single list of every per-portal behaviour switch.
 *
 * - The code is the source of truth for WHICH flags exist and their defaults.
 * - The `feature_flags` table (one per portal database) only stores overrides.
 * - `intended` documents what each portal is supposed to have, so the
 *   super-admin page doubles as a tracker of how the portals differ.
 * - `wired` is true only when application code actually reads the flag. A flag
 *   that is not wired is tracked and visible but read-only, so nobody believes
 *   flipping it changes behaviour when it does not.
 *
 * To add a flag: add an entry here, read it with `isFeatureEnabled(key)` on the
 * server or `useFeatureFlag(key)` on the client, and set `wired: true`.
 * Remove the entry once every portal has the feature permanently.
 */

export type PortalId = "godspeed" | "gdworkforce" | "canhire" | "allstaff";

export const PORTALS: ReadonlyArray<{ id: PortalId; label: string }> = [
  { id: "godspeed", label: "Godspeed" },
  { id: "gdworkforce", label: "GD Workforce" },
  { id: "canhire", label: "CanHire" },
  { id: "allstaff", label: "All Staff" },
];

export type FeatureFlagCategory =
  | "dashboard"
  | "positions"
  | "jobseeker_profile"
  | "admin";

export interface FeatureFlagDefinition {
  /** Stable identifier stored in the database. Never rename once in use. */
  key: string;
  title: string;
  description: string;
  category: FeatureFlagCategory;
  /** Value used when this portal's database has no override row. */
  defaultEnabled: boolean;
  /** True once application code reads this flag. */
  wired: boolean;
  /** Intended state per portal (documentation / tracking). */
  intended: Partial<Record<PortalId, boolean>>;
  /** Extra context for the super-admin page. */
  notes?: string;
}

export const FEATURE_FLAGS: ReadonlyArray<FeatureFlagDefinition> = [
  {
    key: "jobseeker_payroll_summary",
    title: "Jobseeker payroll summary cards",
    description:
      'Shows "Total No. Hours" and "Gross Amount" cards on the Jobseeker dashboard.',
    category: "dashboard",
    defaultEnabled: false,
    wired: true,
    intended: {
      canhire: true,
      gdworkforce: true,
      godspeed: false,
      allstaff: false,
    },
    notes:
      "Requested for CanHire and GD Workforce only. Turn it on from this page for those portals. Hours = regular + overtime; Gross Amount = pay before deductions.",
  },
  {
    key: "subcategory_positions",
    title: "Subcategory positions",
    description:
      "Subcategory position pages, menu entry and the subcategory option in dropdown management.",
    category: "positions",
    defaultEnabled: true,
    wired: true,
    intended: {
      godspeed: false,
      gdworkforce: false,
      canhire: true,
      allstaff: true,
    },
    notes:
      "Today this is hard-coded: the route, menu item and dropdown option are commented out in the Godspeed and GD Workforce branches.",
  },
  {
    key: "attach_handbook_to_assignment_email",
    title: "Employee handbook on assignment email",
    description:
      "Attaches the employee handbook PDF (read from this portal's storage) to the email a jobseeker receives when they are assigned to a position.",
    category: "positions",
    defaultEnabled: false,
    wired: true,
    intended: {
      godspeed: true,
      gdworkforce: false,
      canhire: false,
      allstaff: false,
    },
    notes:
      "Previously hard-coded for Godspeed. The file path and attachment name are still Godspeed's (employeeHandbook/employeeHandbook2024.pdf); moving them into portal settings is a later step.",
  },
  {
    key: "hide_jobseeker_pay_rate",
    title: "Hide pay rate in jobseeker compensation",
    description:
      "Hides the pay rate and bill rate inputs on the jobseeker profile Compensation step (values default to 0).",
    category: "jobseeker_profile",
    defaultEnabled: false,
    wired: true,
    intended: {
      gdworkforce: true,
      godspeed: false,
      canhire: false,
      allstaff: false,
    },
    notes: "Today this is hard-coded in the GD Workforce branch only.",
  },
  {
    key: "jobseeker_profile_godspeed_rules",
    title: "Godspeed jobseeker profile rules",
    description:
      "Lighter jobseeker profile rules: the driver's licence number is required; SIN, most address/qualification fields and the compensation fields are optional; the mandatory document is a driver's licence or passport (instead of SIN + government ID). Applies to the profile forms and to the server checks.",
    category: "jobseeker_profile",
    defaultEnabled: false,
    wired: true,
    intended: {
      godspeed: true,
      gdworkforce: false,
      canhire: false,
      allstaff: false,
    },
    notes:
      "Previously a code fork in the Godspeed branch. Turn on only for portals that want the lighter rules; Godspeed has it on.",
  },
];

const FLAG_BY_KEY = new Map(FEATURE_FLAGS.map((f) => [f.key, f]));

export function getFeatureFlagDefinition(
  key: string
): FeatureFlagDefinition | undefined {
  return FLAG_BY_KEY.get(key);
}

export function isKnownFeatureFlag(key: string): boolean {
  return FLAG_BY_KEY.has(key);
}
