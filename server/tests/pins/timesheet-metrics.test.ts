// API pin for GET /api/timesheet-metrics (R-4, recorded on the code as it is, before the split): the dashboard's
// timesheet cards (the totals over all time, a 30-day trend, a monthly chart).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter"])`, so all eight staff accounts
// (the admin and super admin as "admin", the other six as "recruiter") and not a jobseeker (403).
//
// The answer depends on "now" (the trend compares the last 30 days with the 30 before), so it is asked of the server
// whose clock stands still, and on the nine seeded timesheets: no other test file leaves a timesheet behind.
import { describe, expect, it } from "vitest";
import { matrix, noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";

const DIR = "api-timesheet-metrics";
const PATH = "/api/timesheet-metrics";

describe("GET /api/timesheet-metrics", () => {
  it("the eight staff accounts get the same cards; a jobseeker is refused", async () => {
    const m = await matrix(PATH, STAFF_ROLES, { fixedClock: true });
    expect(Object.keys(m.refused)).toEqual(["jobseeker"]);
    expect(m.refused.jobseeker.status).toBe(403);
    expect((m.answer.answer as any).metrics.map((x: any) => x.id)).toEqual([
      "total_timesheets",
      "total_jobseeker_pay",
      "total_bonus_paid",
      "total_deduction",
      "total_regular_hours",
      "total_overtime_hours",
      "total_miles_logged",
      "total_non_hourly_units",
    ]);
    await pin(DIR, 1, "the cards by role", m);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      2,
      "without a token",
      await noTokenAnswers(PATH, { fixedClock: true })
    );
  });
});
