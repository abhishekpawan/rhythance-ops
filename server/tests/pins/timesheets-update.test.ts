// API pins for PUT /api/timesheets/:id (R-4, recorded on the code as it is, before the split).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter"])` lets the eight staff accounts
// through and refuses a jobseeker with a 403 (DEV-6, inbox 66; before it, a jobseeker could update their own rows and
// move one onto another person's profile). For every role the profile in the body (or on the row) must belong to the
// user id in the body (or on the row): 400 when it does not. Every row below is made by this file (notes start with
// R4-PIN) and the rows are removed in `afterAll`; the seeded timesheets are never written.
//
// The update does not require any field and writes every column the body names; fields it names itself (premium rate,
// tax, email flag, pay segment, line payment method) fall back to defaults when left out, so a partial body resets them.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOBSEEKERS, STAFF } from "../support/api";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  bodyFor,
  call,
  eightHours,
  emailsSent,
  freshWeek,
  generic,
  make,
  mailOf,
  NO_SUCH_ID,
  newEmails,
  PROFILE,
  POSITION,
  rowOf,
  sweep,
} from "./timesheet-helpers";

const DIR = "api-timesheets-update";
beforeAll(sweep);
afterAll(sweep);

const put = (who: Parameters<typeof call>[0], id: string, body: unknown) =>
  call(who, `/api/timesheets/${id}`, { method: "PUT", body });

/** What the entry screen sends after the first day was changed to 12 hours: 44 hours, no overtime, pay 880, bill 1540. */
const edited = (week: { start: string; end: string }, over = {}) =>
  bodyFor("sin", week, {
    daily_hours: eightHours(week.start).map((d, i) =>
      i === 0 ? { ...d, hours: 12 } : d
    ),
    total_regular_hours: 44,
    total_jobseeker_pay: 880,
    total_client_bill: 1540,
    ...over,
  });

describe("PUT /api/timesheets/:id: every role", () => {
  it("each staff account updates a row: version 2, a second history entry, the same row", async () => {
    const out: Record<string, unknown> = {};
    let adminAnswer: unknown;
    for (const role of STAFF_ROLES) {
      const week = freshWeek();
      const row = await make("admin", "sin", {}, week);
      const r = await put(role, row.id, edited(week));
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const t = r.json.timesheet;
      const me = STAFF[role].id;
      expect(t.id).toBe(row.id);
      expect(t.version, role).toBe(2);
      expect(t.version_history, role).toHaveLength(2);
      expect(t.version_history[1].action).toBe("updated");
      expect(t.version_history[1].created_by).toBe(me);
      expect(t.updated_by_user_id).toBe(me);
      expect(t.created_by_user_id).toBe(STAFF.admin.id); // the maker stays
      expect(t.total_jobseeker_pay).toBe(880);
      expect(t.total_client_bill).toBe(1540);
      out[role] = { status: r.status, row: generic(t) };
      if (role === "admin") adminAnswer = answerOfRun(r);
    }
    // a jobseeker is refused on their own row (DEV-6)
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    const refused = await put("js:sin", row.id, edited(week));
    expect(refused.status, refused.text).toBe(403);
    expect((await rowOf(row.id)).version).toBe(1);

    for (const [role, v] of Object.entries(out)) {
      expect(v, role).toEqual(out.admin);
    }
    await pin(DIR, 1, "the update by the admin", adminAnswer);
    await pin(DIR, 2, "the updated row, the same from every role", {
      roles: [...STAFF_ROLES],
      ...(out.admin as object),
    });
  });

  it("updating twice goes to version 3 with three history entries", async () => {
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    await put("admin", row.id, edited(week));
    const r = await put(
      "bookkeeper",
      row.id,
      edited(week, { total_regular_hours: 45 })
    );
    expect(r.json.timesheet.version).toBe(3);
    await pin(DIR, 3, "the second update", answerOfRun(r));
  });

  it("no token is 401, a bad token 403", async () => {
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    await pin(
      DIR,
      4,
      "without a token",
      await noTokenAnswers(`/api/timesheets/${row.id}`, {
        method: "PUT",
        body: edited(week),
      })
    );
    expect((await rowOf(row.id)).version).toBe(1);
  });
});

describe("PUT /api/timesheets/:id: what the server refuses", () => {
  it("a row that is not there, or an id that is not an id, is a 404", async () => {
    const week = freshWeek();
    await pin(DIR, 5, "nothing to update", {
      "an id nobody has": answerOfRun(
        await put("admin", NO_SUCH_ID, edited(week))
      ),
      "an id that is not a uuid": answerOfRun(
        await put("admin", "not-an-id", edited(week))
      ),
    });
  });

  it("a second timesheet in the same jobseeker, position, week and segment is a 409; moving to a free week is fine", async () => {
    const weekA = freshWeek();
    const weekB = freshWeek();
    const a = await make("admin", "sin", {}, weekA);
    const b = await make("admin", "sin", {}, weekB);
    const out: Record<string, unknown> = {};
    out["into the week of another row"] = answerOfRun(
      await put("admin", b.id, bodyFor("sin", weekA))
    );
    out["into the same week, another position"] = answerOfRun(
      await put(
        "admin",
        b.id,
        bodyFor("sin", weekA, { position_id: POSITION.forklift })
      )
    );
    out["to a week nobody has"] = answerOfRun(
      await put("admin", a.id, bodyFor("sin", freshWeek()))
    );
    expect((out["into the week of another row"] as any).status).toBe(409);
    await pin(DIR, 6, "duplicates", out);
  });

  it("bulk rows are compared only with bulk rows", async () => {
    const week = freshWeek();
    const bulkBody = (w: { start: string; end: string }) => {
      const b = bodyFor("sin", w, { is_bulk: true, bulk_breakdown: [] });
      delete b.position_id;
      return b;
    };
    const first = await call("admin", "/api/timesheets", {
      method: "POST",
      body: bulkBody(week),
    });
    const other = await call("admin", "/api/timesheets", {
      method: "POST",
      body: bulkBody(freshWeek()),
    });
    expect(first.status, first.text).toBe(201);
    expect(other.status, other.text).toBe(201);
    const clash = await put("admin", other.json.timesheet.id, bulkBody(week));
    await pin(DIR, 7, "bulk duplicate", answerOfRun(clash));
  });
});

describe("PUT /api/timesheets/:id: the body decides what is stored", () => {
  it("a partial body is accepted; the fields that have defaults go back to them", async () => {
    const week = freshWeek();
    const row = await make("admin", "corp", {}, week);
    // make a row that has non-default values in every field a partial body resets
    const loaded = await put(
      "admin",
      row.id,
      bodyFor("corp", week, {
        position_id: POSITION.driver,
        premium_pay_rate: 2.5,
        tax_amount: 117,
        total_jobseeker_pay: 1017,
        pay_split_segment: "cash",
        line_payment_method: "Cash",
      })
    );
    expect(loaded.status, loaded.text).toBe(200);
    const partial = await put("admin", row.id, { total_regular_hours: 41 });
    expect(partial.status, partial.text).toBe(200);
    // what the row held before is gone: premium rate 0, tax 0, email flag false, segment single, no line method;
    // the pay and bill are still the loaded ones
    const t = partial.json.timesheet;
    expect([
      t.premium_pay_rate,
      t.tax_amount,
      t.email_sent,
      t.pay_split_segment,
      t.line_payment_method,
    ]).toEqual([0, 0, false, "single", null]);
    expect(t.total_jobseeker_pay).toBe(1017);
    await pin(DIR, 8, "a partial body", {
      "loaded first": answerOfRun(loaded),
      "then only the hours": answerOfRun(partial),
    });
  });

  it("the money fields are stored as sent, to the cent", async () => {
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    const r = await put(
      "admin",
      row.id,
      bodyFor("sin", week, {
        total_regular_hours: 39.75,
        total_jobseeker_pay: 1234.57,
        total_client_bill: 2345.68,
        bonus_amount: 12.34,
        deduction_amount: 5.67,
        tax_amount: 8.9,
      })
    );
    expect(r.status, r.text).toBe(200);
    await pin(DIR, 9, "cents", answerOfRun(r));
  });

  it("a staff update can move a row to another jobseeker's profile", async () => {
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    const r = await put("admin", row.id, bodyFor("cash", week));
    expect(r.status, r.text).toBe(200);
    expect((await rowOf(row.id)).jobseeker_profile_id).toBe(PROFILE.cash);
    await pin(DIR, 10, "moved to another profile by staff", answerOfRun(r));
  });
});

describe("PUT /api/timesheets/:id: who may update whose", () => {
  it("a jobseeker may not update any row, their own or another's: 403, and the rows stay as they were", async () => {
    const mine = await make("admin", "sin");
    const casey = await make("admin", "cash");
    const out: Record<string, unknown> = {};
    out["own row"] = answerOfRun(
      await put(
        "js:sin",
        mine.id,
        bodyFor(
          "sin",
          { start: mine.week_start_date, end: mine.week_end_date },
          { total_jobseeker_pay: 810 }
        )
      )
    );
    out["another jobseeker's row"] = answerOfRun(
      await put(
        "js:sin",
        casey.id,
        bodyFor(
          "cash",
          { start: casey.week_start_date, end: casey.week_end_date },
          { total_jobseeker_pay: 1 }
        )
      )
    );
    expect((out["own row"] as any).status).toBe(403);
    expect((out["another jobseeker's row"] as any).status).toBe(403);
    expect((await rowOf(mine.id)).total_jobseeker_pay).toBe(800);
    expect((await rowOf(casey.id)).total_jobseeker_pay).toBe(800);
    await pin(DIR, 11, "jobseeker, own and another's", out);
  });

  it("a jobseeker may not put another user id in the body of their own row: 403, nothing changes", async () => {
    const mine = await make("admin", "sin");
    const r = await put(
      "js:sin",
      mine.id,
      bodyFor(
        "sin",
        { start: mine.week_start_date, end: mine.week_end_date },
        { jobseeker_user_id: JOBSEEKERS.cash.id }
      )
    );
    expect(r.status).toBe(403);
    expect((await rowOf(mine.id)).version).toBe(1);
    await pin(
      DIR,
      12,
      "jobseeker, another user id in the body",
      answerOfRun(r)
    );
  });

  it("a jobseeker cannot move their own row to another jobseeker's profile (inbox 66): 403, the row stays", async () => {
    const mine = await make("admin", "sin");
    const week = { start: mine.week_start_date, end: mine.week_end_date };
    const r = await put(
      "js:sin",
      mine.id,
      bodyFor("cash", week, { jobseeker_user_id: JOBSEEKERS.sin.id })
    );
    expect(r.status, r.text).toBe(403);
    const row = await rowOf(mine.id);
    expect(row.jobseeker_profile_id).toBe(PROFILE.sin);
    expect(row.version).toBe(1);
    await pin(
      DIR,
      13,
      "jobseeker moves own row to another profile",
      answerOfRun(r)
    );
  });
});

describe("PUT /api/timesheets/:id: messages", () => {
  it("email_sent true sends the update email to the jobseeker; email_sent false sends none", async () => {
    const week = freshWeek();
    const row = await make("admin", "sin", {}, week);
    const before = emailsSent().length;
    const quiet = await put("admin", row.id, edited(week));
    expect(quiet.status).toBe(200);
    expect(await newEmails(before, 0)).toEqual([]);

    const loud = await put("admin", row.id, edited(week, { email_sent: true }));
    expect(loud.status, loud.text).toBe(200);
    const sent = await newEmails(before, 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["jobseeker.sin@example.test"]);
    await pin(DIR, 14, "the update email", {
      answer: answerOfRun(loud),
      messages: sent.map(mailOf),
    });
  });
});

describe("PUT /api/timesheets/:id: matching ids, later in the file so the weeks of the pins above do not move", () => {
  it("staff cannot put a row on a profile that is not the user id's, nor a user id on a profile that is not theirs: 400, the row stays", async () => {
    const mine = await make("admin", "sin");
    const week = { start: mine.week_start_date, end: mine.week_end_date };
    const out: Record<string, unknown> = {};
    // the profile moves, the user id stays Sam's (in the body)
    out["profile only, in the body with Sam's user id"] = answerOfRun(
      await put(
        "admin",
        mine.id,
        bodyFor("cash", week, { jobseeker_user_id: JOBSEEKERS.sin.id })
      )
    );
    // the profile moves and the body names no user id: the row's user id is Sam's
    const noUser = bodyFor("cash", week);
    delete noUser.jobseeker_user_id;
    out["profile only, no user id in the body"] = answerOfRun(
      await put("admin", mine.id, noUser)
    );
    // the user id moves and the body names no profile: the row's profile is Sam's
    const noProfile = bodyFor("sin", week, {
      jobseeker_user_id: JOBSEEKERS.cash.id,
    });
    delete noProfile.jobseeker_profile_id;
    out["user id only, no profile in the body"] = answerOfRun(
      await put("admin", mine.id, noProfile)
    );
    // a profile nobody has
    out["a profile nobody has"] = answerOfRun(
      await put(
        "admin",
        mine.id,
        bodyFor("sin", week, { jobseeker_profile_id: NO_SUCH_ID })
      )
    );
    for (const [name, v] of Object.entries(out)) {
      expect((v as any).status, name).toBe(400);
    }
    const row = await rowOf(mine.id);
    expect(row.jobseeker_profile_id).toBe(PROFILE.sin);
    expect(row.jobseeker_user_id).toBe(JOBSEEKERS.sin.id);
    expect(row.version).toBe(1);
    await pin(DIR, 15, "staff, user id and profile of two people", out);
  });
});
