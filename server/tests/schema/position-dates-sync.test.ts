// Inbox 4 / DEV-1: migration 028. Changing a position's start or end date also moves its active and upcoming
// assignments (and the position's assigned_jobseekers). Production and stage did not have the trigger; the
// files do, so this runs against the database built from the files, and each case is rolled back.
import { describe, expect, it } from "vitest";
import { rolledBack } from "../support/rolled-back";

const POSITION = "00000000-0000-4000-8000-000000000031"; // three active assignments, ending 2027-03-31

const assignments = `SELECT json_build_object(
  'ends', (SELECT json_agg(DISTINCT end_date::text) FROM position_candidate_assignments WHERE position_id = '${POSITION}' AND status IN ('active','upcoming')),
  'statuses', (SELECT json_agg(DISTINCT status) FROM position_candidate_assignments WHERE position_id = '${POSITION}' AND id IN ('00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000074')),
  'assigned', (SELECT coalesce(array_length(assigned_jobseekers,1),0) FROM positions WHERE id = '${POSITION}')
);`;

describe("migration 028: a position's dates move its open assignments", () => {
  it("a new end date in the future becomes the end date of every active assignment", () => {
    const out = JSON.parse(
      rolledBack(
        `UPDATE positions SET end_date = '2027-06-30' WHERE id = '${POSITION}'; ${assignments}`
      )
    );
    expect(out.ends).toEqual(["2027-06-30"]);
    expect(out.statuses).toEqual(["active"]);
    expect(out.assigned).toBe(3);
  });

  it("an end date in the past completes them and empties assigned_jobseekers", () => {
    const out = JSON.parse(
      rolledBack(
        `UPDATE positions SET end_date = '2026-10-01' WHERE id = '${POSITION}'; ${assignments}`
      )
    );
    expect(out.ends).toBeNull(); // none left active or upcoming
    expect(out.statuses).toEqual(["completed"]);
    expect(out.assigned).toBe(0);
  });

  it("a start date in the future makes them upcoming", () => {
    const out = JSON.parse(
      rolledBack(
        `UPDATE positions SET start_date = '2027-01-15', end_date = '2027-09-30' WHERE id = '${POSITION}'; ${assignments}`
      )
    );
    expect(out.statuses).toEqual(["upcoming"]);
    expect(out.assigned).toBe(0);
  });

  it("changing something else leaves the assignments alone", () => {
    const out = JSON.parse(
      rolledBack(
        `UPDATE positions SET title = title || ' ' WHERE id = '${POSITION}'; ${assignments}`
      )
    );
    expect(out.ends).toEqual(["2027-03-31"]);
  });
});
