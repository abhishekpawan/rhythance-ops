// The synthetic accounts of the test seed (server/tests/seed/ids.mjs): one per staff role, jobseekers,
// one throwaway password. Nothing here is real.
import {
  JOBSEEKERS,
  PASSWORD,
  SIGNUP_JOBSEEKER,
  STAFF,
} from "../../server/tests/seed/ids.mjs";

export type Account = { email: string; name: string };

export { PASSWORD };

/** key (admin, superadmin, recruiter, bookkeeper, ...) -> account */
export const staff: Record<string, Account> = STAFF;
export const jobseekers: Record<string, Account> = JOBSEEKERS;
export const signupJobseeker: Account = SIGNUP_JOBSEEKER;

/** The one code the test server's SMS stand-in approves (server/tests/support/outbound-guard.mjs). */
export const SMS_CODE = "000000";

/** The accounts the Reports journeys start signed in as (tests/auth.setup.ts saves their browser state). */
export const SIGNED_IN_ROLES = ["admin", "accountant_manager"] as const;

/** Extra accounts the Support journeys start signed in as (saved by tests/auth.setup.ts like the ones above). */
export const SUPPORT_SIGNED_IN_ROLES = [
  "recruiter",
  "superadmin",
  "bookkeeper",
  "sales",
] as const;
