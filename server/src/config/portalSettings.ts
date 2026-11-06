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

export type PortalSettingGroup = "company" | "branding" | "training";

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
}

export const PORTAL_SETTINGS: ReadonlyArray<PortalSettingDefinition> = [
  {
    key: "company.name",
    group: "company",
    label: "Company name",
    description: "Legal company name printed at the top of invoices.",
    defaultValue: "9084380 Canada Inc. O/A Motion Falcon Group",
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
    defaultValue: "Motion Falcon AI Chat",
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
