import { getPortalSettingSync } from "../services/portalSettings.js";

const settingList = (key: string): string[] =>
  getPortalSettingSync(key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Whether an email belongs to staff. The list comes from this portal's settings
// (Portal Settings > Access); nothing is hard-coded.
export const isRecruiterEmail = (rawEmail: string): boolean => {
  // Case does not matter: "Admin@Email.com" is the same address as "admin@email.com".
  const email = String(rawEmail ?? "")
    .trim()
    .toLowerCase();
  const list = (key: string) =>
    settingList(key).map((item) => item.toLowerCase());
  if (list("access.staffEmailExcluded").includes(email)) return false;
  // An entry ending with "$" must match the end of the email (@email.com$).
  return list("access.staffEmailContains").some((part) =>
    part.endsWith("$")
      ? email.endsWith(part.slice(0, -1))
      : email.includes(part)
  );
};
