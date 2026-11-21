// API pins for the two calendar endpoints (server/src/routes/calendar.ts): the events of a date range and its summary,
// recorded on the code as it is (R-3). Read only: nothing is written.
//
// Who may call what, worked out from the route: `authorizeRoles(["admin", "recruiter"])`, so all eight staff accounts
// (the admin and super admin as "admin", the six others as "recruiter") and not the jobseeker (403).
//
// The data is the seed's (tests/seed/data.sql), whose dates are fixed; the requests carry their own dates, and the
// server whose clock stands still is used as the other pins do. Worked out from the seed, for November 2026:
//   * a position shows when it ends on or after the first day and starts on or before the last day, and an open end date
//     (null) never matches, so "Forklift Operator" (2 places) and "Loader" (4 places) are not on the calendar at all;
//   * "Warehouse Associate" (3 places) has three assignments (Sam, and two more), "Driver Helper" (2 places) has one;
//     the training portion (a subcategory) and "Line Cook Helper" (ended 31 October) are left out;
//   * so 5 places, 4 assignments, 4 jobseekers, and one open-position event for Driver Helper (1 place left).
import { describe, expect, it } from "vitest";
import { JOBSEEKERS } from "../support/api";
import {
  as,
  everyRole,
  noTokenAnswers,
  pin,
  STAFF_ROLES,
  type Role,
} from "./module-helpers";

const DIR = "api-calendar";
const READERS: Role[] = [...STAFF_ROLES];
const NOVEMBER = "startDate=2026-11-01&endDate=2026-11-30";
const CLIENT_QUEBEC = "00000000-0000-4000-8000-000000000022";
const CLIENT_NONE = "00000000-0000-4000-8000-0000000000ee";

/**
 * The route reads positions and assignments with no sort, so the database may answer them in any order. The events are
 * put in order of their id before they are stored or compared (a change in what is on the calendar still fails).
 */
function tidy(answer: any) {
  const events = answer?.data?.events;
  if (!Array.isArray(events)) return answer;
  return {
    ...answer,
    data: {
      ...answer.data,
      events: [...events].sort((a, b) => (a.id < b.id ? -1 : 1)),
    },
  };
}

const get = (path: string, role: Role = "admin") =>
  as(role, path, { fixedClock: true });

/** Every staff account must get the same answer; the jobseeker is refused. Stored: the answer once, and the refusal. */
async function readAs(path: string) {
  const all = await everyRole(path, { fixedClock: true });
  const sorted = (role: Role) => ({
    ...all[role],
    answer: tidy(all[role].answer),
  });
  for (const role of READERS)
    expect(sorted(role), role).toEqual(sorted("admin"));
  return {
    allowed: READERS,
    answer: sorted("admin"),
    refused: { jobseeker: all.jobseeker },
  };
}

describe("GET /api/calendar", () => {
  const CASES: Array<[string, string]> = [
    ["november", `?${NOVEMBER}`],
    ["one client", `?${NOVEMBER}&clientId=${CLIENT_QUEBEC}`],
    ["one jobseeker", `?${NOVEMBER}&jobseekerId=${JOBSEEKERS.sin.id}`],
    [
      "one client and one jobseeker who is not there",
      `?${NOVEMBER}&clientId=${CLIENT_QUEBEC}&jobseekerId=${JOBSEEKERS.sin.id}`,
    ],
    ["a client nobody has", `?${NOVEMBER}&clientId=${CLIENT_NONE}`],
    ["august to october", "?startDate=2026-08-01&endDate=2026-10-31"],
    ["one day", "?startDate=2026-10-31&endDate=2026-10-31"],
    ["a range with nothing in it", "?startDate=2030-01-01&endDate=2030-01-31"],
    ["the end before the start", "?startDate=2026-11-30&endDate=2026-11-01"],
  ];
  CASES.forEach(([name, query], i) =>
    it(`${name}`, async () => {
      const r = await get(`/api/calendar${query}`);
      expect(r.status).toBe(200);
      await pin(DIR, i + 1, `events ${name}`, {
        status: r.status,
        answer: tidy(r.json),
      });
    })
  );

  it("november, worked out from the seed", async () => {
    const r = await get(`/api/calendar?${NOVEMBER}`);
    expect(r.json.data.summary).toEqual({
      totalPositions: 5,
      totalJobseekers: 4,
      activeAssignments: 4,
    });
    const titles = r.json.data.events.map((e: any) => e.title).sort();
    expect(titles).toEqual([
      "Casey Cashman - Warehouse Associate",
      "Corey Corporate - Driver Helper",
      "Driver Helper (1 available)",
      "Hana Hybrid - Warehouse Associate",
      "Sam Sinclair - Warehouse Associate",
    ]);
    // no event for the open-ended positions, the subcategory or the ended one
    const text = JSON.stringify(r.json);
    for (const left of [
      "Forklift Operator",
      "Loader",
      "training portion",
      "Line Cook Helper",
    ]) {
      expect(text, left).not.toContain(left);
    }
    expect(
      r.json.data.events.filter(
        (e: any) => e.positionTitle === "Warehouse Associate"
      )
    ).toHaveLength(3);
    expect(r.json.data.events.filter((e: any) => !e.jobseekerId)).toHaveLength(
      1
    );
  });

  it("who may read: every staff account the same, a jobseeker refused", async () => {
    await pin(
      DIR,
      10,
      "events by role",
      await readAs(`/api/calendar?${NOVEMBER}`)
    );
  });

  it("validation", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, query] of [
      ["no dates", ""],
      ["no end", "?startDate=2026-11-01"],
      ["no start", "?endDate=2026-11-30"],
      ["a date with a slash", "?startDate=2026/11/01&endDate=2026-11-30"],
      [
        "a date with a time",
        "?startDate=2026-11-01T00:00:00Z&endDate=2026-11-30",
      ],
      ["a day that is not a day", "?startDate=2026-13-45&endDate=2026-11-30"],
      ["a client that is not an id", `?${NOVEMBER}&clientId=nope`],
      ["a jobseeker that is not an id", `?${NOVEMBER}&jobseekerId=nope`],
    ] as const) {
      const r = await get(`/api/calendar${query}`);
      out[name] = { status: r.status, answer: r.json ?? r.text };
    }
    await pin(DIR, 11, "events validation", out);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      12,
      "events without a token",
      await noTokenAnswers(`/api/calendar?${NOVEMBER}`, { fixedClock: true })
    );
  });
});

describe("GET /api/calendar/summary", () => {
  const CASES: Array<[string, string]> = [
    ["november", `?${NOVEMBER}`],
    ["one client", `?${NOVEMBER}&clientId=${CLIENT_QUEBEC}`],
    ["one jobseeker", `?${NOVEMBER}&jobseekerId=${JOBSEEKERS.sin.id}`],
    ["a client nobody has", `?${NOVEMBER}&clientId=${CLIENT_NONE}`],
    ["august to october", "?startDate=2026-08-01&endDate=2026-10-31"],
    ["a range with nothing in it", "?startDate=2030-01-01&endDate=2030-01-31"],
    [
      "the whole of the seeded year",
      "?startDate=2026-01-01&endDate=2027-12-31",
    ],
  ];
  CASES.forEach(([name, query], i) =>
    it(`${name}`, async () => {
      const r = await get(`/api/calendar/summary${query}`);
      expect(r.status).toBe(200);
      await pin(DIR, 20 + i, `summary ${name}`, {
        status: r.status,
        answer: r.json,
      });
    })
  );

  it("november, worked out from the seed", async () => {
    const r = await get(`/api/calendar/summary?${NOVEMBER}`);
    // 5 places, 4 assignments (all active), 4 different people, 1 place left, 4 of 5 filled is 80 %
    expect(r.json.data).toEqual({
      totalPositions: 5,
      totalJobseekers: 4,
      activeAssignments: 4,
      availablePositions: 1,
      fillRate: 80,
      statusBreakdown: { active: 4, upcoming: 0, completed: 0, cancelled: 0 },
      dateRange: { startDate: "2026-11-01", endDate: "2026-11-30" },
    });
    // the same days in the two answers
    const events = await get(`/api/calendar?${NOVEMBER}`);
    expect(events.json.data.summary.activeAssignments).toBe(
      r.json.data.activeAssignments
    );
  });

  it("who may read: every staff account the same, a jobseeker refused", async () => {
    await pin(
      DIR,
      30,
      "summary by role",
      await readAs(`/api/calendar/summary?${NOVEMBER}`)
    );
  });

  it("validation", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, query] of [
      ["no dates", ""],
      ["a date with a slash", "?startDate=2026/11/01&endDate=2026-11-30"],
      ["a client that is not an id", `?${NOVEMBER}&clientId=nope`],
    ] as const) {
      const r = await get(`/api/calendar/summary${query}`);
      out[name] = { status: r.status, answer: r.json ?? r.text };
    }
    await pin(DIR, 31, "summary validation", out);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      32,
      "summary without a token",
      await noTokenAnswers(`/api/calendar/summary?${NOVEMBER}`, {
        fixedClock: true,
      })
    );
  });
});
