// API pins for the timesheet reads (R-4, recorded on the code as it is, before the split):
//   GET /api/timesheets                       the list, with its filters and paging
//   GET /api/timesheets/:id                   one timesheet with its jobseeker and position
//   GET /api/timesheets/jobseeker/:userId     one jobseeker's timesheets
//   GET /api/timesheets/generate-invoice-number
//   GET /api/timesheet-metrics                (timesheet-metrics.test.ts)
//
// Who may call what, worked out from the routes: `authorizeRoles(["admin", "recruiter", "jobseeker"])` lets all nine
// accounts through, so no role is refused by the route. What differs is data: a jobseeker's list and detail are
// limited to their own user id (a timesheet that is not theirs is "not found", 404), and a jobseeker asking for
// another jobseeker's list is refused with 403. The eight staff accounts must all get the same answer.
//
// Reads only; the nine seeded timesheets (ids 51 to 59, see data.sql) are never written. Every other file that writes
// timesheets removes its rows, so these answers are the seed's.
import { describe, expect, it } from "vitest";
import { JOBSEEKERS } from "../support/api";
import { noTokenAnswers, pin } from "./module-helpers";
import {
  answerOf,
  byIdWithin,
  call,
  NO_SUCH_ID,
  SEEDED,
  staffAndJobseekers,
} from "./timesheet-helpers";

const LIST = "api-timesheets-list";
const ONE = "api-timesheets-get";
const BY_USER = "api-timesheets-jobseeker";
const NUMBER = "api-timesheets-invoice-number";

/**
 * The list is ordered by `created_at` only, and four seeded rows share one created_at (two more share another):
 * the database may answer ties in any order. Every page below ends where a group of equal created_at ends, so which
 * rows are on a page is fixed; the order inside the page is not, so a page is stored in order of id.
 */
const tidyList = byIdWithin("timesheets");

describe("GET /api/timesheets", () => {
  const CASES: Array<[string, string]> = [
    ["everything, first page of ten", ""],
    ["six to a page, first page", "?limit=6"],
    ["six to a page, second page", "?limit=6&page=2"],
    ["six to a page, a page past the end", "?limit=6&page=3"],
    ["the invoice number filter", "?invoiceNumberFilter=900002"],
    ["a part of an invoice number in the filter", "?invoiceNumberFilter=9000"],
    ["the search term (all four columns must match)", "?searchTerm=900002"],
    ["the search term on a position code", "?searchTerm=NW001"],
    ["the jobseeker filter reads the first name", "?jobseekerFilter=Casey"],
    [
      "the jobseeker filter on a last name finds nothing",
      "?jobseekerFilter=Cashman",
    ],
    ["the position filter", "?positionFilter=Loader"],
    ["the client filter", "?clientFilter=Quebec"],
    [
      "the billing email filter (no seeded profile has one)",
      "?billingEmailFilter=example",
    ],
    ["emails sent", "?emailSentFilter=true"],
    ["emails not sent", "?emailSentFilter=false"],
    [
      "one week by its dates",
      "?dateRangeStart=2026-11-01&dateRangeEnd=2026-11-07",
    ],
    ["from a date", "?dateRangeStart=2026-11-08"],
    ["to a date", "?dateRangeEnd=2026-10-31"],
    [
      "two filters together",
      "?jobseekerFilter=Sam&dateRangeStart=2026-11-01&dateRangeEnd=2026-11-30",
    ],
    [
      "the filters are case-insensitive",
      "?clientFilter=quebec&positionFilter=DRIVER",
    ],
    ["the exclude-bulk setting is not read by the list", "?excludeBulk=true"],
    ["a page that is not a number", "?page=abc"],
    ["a limit that is not a number", "?limit=abc"],
    ["a limit of zero", "?limit=0"],
    ["page zero", "?page=0"],
  ];

  CASES.forEach(([name, query], i) => {
    it(`${name}`, async () => {
      const got = await staffAndJobseekers(`/api/timesheets${query}`, tidyList);
      await pin(LIST, i + 1, name, got);
    });
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      LIST,
      CASES.length + 1,
      "without a token",
      await noTokenAnswers("/api/timesheets")
    );
  });

  it("a jobseeker sees only their own, whatever the filter says", async () => {
    const own = await call("js:sin", "/api/timesheets?limit=50");
    expect(own.status).toBe(200);
    expect(own.json.timesheets.map((t: any) => t.id).sort()).toEqual(
      [SEEDED[0], SEEDED[1], SEEDED[8]].sort() // 51, 52, 59: Sam's three
    );
    // the other jobseeker's name as the filter does not open the other jobseeker's rows
    const probe = await call("js:sin", "/api/timesheets?jobseekerFilter=Casey");
    expect(probe.json.timesheets).toEqual([]);
    // the unfiltered total counts only the jobseeker's own rows
    expect(own.json.pagination.total).toBe(3);
  });
});

describe("GET /api/timesheets/:id", () => {
  SEEDED.forEach((id, i) => {
    it(`the seeded timesheet ${51 + i}`, async () => {
      const r = await call("admin", `/api/timesheets/${id}`);
      expect(r.status).toBe(200);
      await pin(ONE, i + 1, `seeded timesheet ${51 + i}`, answerOf(r));
    });
  });

  it("every staff role gets the same; a jobseeker gets their own and a 404 for anyone else's", async () => {
    const got = await staffAndJobseekers(`/api/timesheets/${SEEDED[0]}`);
    // 51 is Sam's: only Sam (and staff) can open it
    expect(got.jobseekers.sin).toEqual({
      status: 200,
      answer: got.staff.answer,
    });
    for (const other of ["cash", "hybrid", "corp", "hybridEt", "signup"]) {
      expect((got.jobseekers[other] as any).status, other).toBe(404);
    }
    await pin(ONE, 10, "timesheet 51 by who asks", got);
  });

  it("a timesheet that is not there, and an id that is not an id", async () => {
    const none = await call("admin", `/api/timesheets/${NO_SUCH_ID}`);
    const bad = await call("admin", "/api/timesheets/not-an-id");
    await pin(ONE, 11, "an id nobody has", answerOf(none));
    await pin(ONE, 12, "an id that is not a uuid", answerOf(bad));
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      ONE,
      13,
      "without a token",
      await noTokenAnswers(`/api/timesheets/${SEEDED[0]}`)
    );
  });
});

describe("GET /api/timesheets/jobseeker/:jobseekerUserId", () => {
  const sam = JOBSEEKERS.sin.id;
  const hana = JOBSEEKERS.hybrid.id;
  const casey = JOBSEEKERS.cash.id;
  // ordered by week start, newest first; two rows of one week (the hybrid split) swap freely
  const tidy = byIdWithin("timesheets", "week_start_date");

  const CASES: Array<[string, string]> = [
    ["Sam, three weeks", `/api/timesheets/jobseeker/${sam}`],
    [
      "Sam, one to a page, second page",
      `/api/timesheets/jobseeker/${sam}?limit=1&page=2`,
    ],
    [
      "Sam, from a date",
      `/api/timesheets/jobseeker/${sam}?dateRangeStart=2026-11-01`,
    ],
    [
      "Sam, to a date",
      `/api/timesheets/jobseeker/${sam}?dateRangeEnd=2026-10-31`,
    ],
    ["Hana, the hybrid week as two rows", `/api/timesheets/jobseeker/${hana}`],
    ["Casey, one timesheet", `/api/timesheets/jobseeker/${casey}`],
    ["a user nobody has", `/api/timesheets/jobseeker/${NO_SUCH_ID}`],
    ["an id that is not an id", "/api/timesheets/jobseeker/not-an-id"],
    [
      "a page that is not a number",
      `/api/timesheets/jobseeker/${sam}?page=abc`,
    ],
  ];

  CASES.forEach(([name, path], i) => {
    it(`${name}`, async () => {
      const got = await staffAndJobseekers(path, tidy);
      await pin(BY_USER, i + 1, name, got);
    });
  });

  it("a jobseeker may read their own list and nobody else's", async () => {
    const own = await call("js:sin", `/api/timesheets/jobseeker/${sam}`);
    expect(own.status).toBe(200);
    for (const key of ["cash", "hybrid", "corp", "hybridEt"] as const) {
      const r = await call(
        "js:sin",
        `/api/timesheets/jobseeker/${JOBSEEKERS[key].id}`
      );
      expect(r.status, key).toBe(403);
    }
    const reverse = await call("js:cash", `/api/timesheets/jobseeker/${sam}`);
    expect(reverse.status).toBe(403);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      BY_USER,
      CASES.length + 1,
      "without a token",
      await noTokenAnswers(`/api/timesheets/jobseeker/${sam}`)
    );
  });
});

describe("GET /api/timesheets/generate-invoice-number", () => {
  it("every account gets the number after the highest stored one (the seed's highest is 900005)", async () => {
    const got = await staffAndJobseekers(
      "/api/timesheets/generate-invoice-number"
    );
    expect((got.staff as any).answer).toEqual({
      success: true,
      invoice_number: "900006",
    });
    await pin(NUMBER, 1, "who gets a number", got);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      NUMBER,
      2,
      "without a token",
      await noTokenAnswers("/api/timesheets/generate-invoice-number")
    );
  });
});
