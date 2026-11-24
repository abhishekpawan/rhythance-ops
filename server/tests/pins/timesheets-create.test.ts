// API pins for POST /api/timesheets (R-4, recorded on the code as it is, before the split).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter"])` lets the eight staff accounts
// through and refuses a jobseeker with a 403 (DEV-6, inbox 66; before it, a jobseeker could create a timesheet for
// their own user id on any profile). For every role `jobseeker_profile_id` must belong to `jobseeker_user_id`: 400.
//
// The server stores what the browser computed: the totals are in the body (`docs/development/testing.md`, "Money is
// calculated in the browser"), so every money case below sends the body the entry screen sends and pins the row as
// stored, exact to the cent. Writes run only on rows this file makes (notes start with R4-PIN); they are removed in
// `afterAll` (and swept before, in case an earlier run failed). A message the server sends is recorded, never sent.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOBSEEKERS, STAFF } from "../support/api";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  bodyFor,
  call,
  emailsSent,
  freshWeek,
  generic,
  mailOf,
  NO_SUCH_ID,
  newEmails,
  NOTE,
  POSITION,
  PROFILE,
  rowsWithNote,
  settled,
  sweep,
} from "./timesheet-helpers";

const DIR = "api-timesheets-create";
beforeAll(sweep);
afterAll(sweep);

const post = (who: Parameters<typeof call>[0], body: unknown) =>
  call(who, "/api/timesheets", { method: "POST", body });

describe("POST /api/timesheets: every role", () => {
  it("each staff account creates a timesheet; the stored rows differ only by who made them", async () => {
    const week = freshWeek();
    const first = await post("admin", bodyFor("sin", week));
    expect(first.status, first.text).toBe(201);
    await pin(DIR, 1, "an ordinary week by the admin", answerOfRun(first));

    const rows: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const r = await post(role, bodyFor("sin", freshWeek()));
      expect(r.status, `${role}: ${r.text}`).toBe(201);
      // made by that account, version 1, one history entry written by it
      const t = r.json.timesheet;
      expect(t.created_by_user_id, role).toBe(STAFF[role].id);
      expect(t.updated_by_user_id, role).toBe(STAFF[role].id);
      expect(t.version, role).toBe(1);
      expect(t.version_history, role).toHaveLength(1);
      expect(t.version_history[0].created_by, role).toBe(STAFF[role].id);
      expect(t.version_history[0].action, role).toBe("created");
      rows[role] = { status: r.status, row: generic(t) };
    }
    // a jobseeker is refused whatever the body (DEV-6)
    const own = await post("js:sin", bodyFor("sin", freshWeek()));
    expect(own.status, own.text).toBe(403);

    for (const [role, v] of Object.entries(rows)) {
      expect(v, role).toEqual(rows.admin);
    }
    await pin(DIR, 2, "the stored row, the same from every role", {
      roles: [...STAFF_ROLES],
      ...(rows.admin as object),
    });
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      3,
      "without a token",
      await noTokenAnswers("/api/timesheets", {
        method: "POST",
        body: bodyFor("sin", freshWeek()),
      })
    );
  });
});

describe("POST /api/timesheets: what the server refuses", () => {
  const REQUIRED = [
    "jobseeker_profile_id",
    "jobseeker_user_id",
    "week_start_date",
    "week_end_date",
    "daily_hours",
    "total_regular_hours",
    "total_overtime_hours",
    "regular_pay_rate",
    "overtime_pay_rate",
    "regular_bill_rate",
    "overtime_bill_rate",
    "total_jobseeker_pay",
    "total_client_bill",
    "overtime_enabled",
  ];

  it("each required field missing, or null, is a 400 that names it; nothing is stored", async () => {
    const out: Record<string, unknown> = {};
    for (const field of REQUIRED) {
      const gone = { ...bodyFor("sin", freshWeek()) };
      delete gone[field];
      out[`${field} missing`] = answerOfRun(await post("admin", gone));
      const nulled = { ...bodyFor("sin", freshWeek()), [field]: null };
      out[`${field} null`] = answerOfRun(await post("admin", nulled));
    }
    // zero and false are values, not missing
    const zeros = await post(
      "admin",
      bodyFor("sin", freshWeek(), {
        total_regular_hours: 0,
        total_jobseeker_pay: 0,
        total_client_bill: 0,
        overtime_enabled: false,
      })
    );
    expect(zeros.status).toBe(201);
    out["zeros and false"] = answerOfRun(zeros);
    await pin(DIR, 4, "required fields", out);
  });

  it("a position is required unless the timesheet is a bulk one", async () => {
    const none = bodyFor("sin", freshWeek());
    delete none.position_id;
    const nulled = bodyFor("sin", freshWeek(), { position_id: null });
    await pin(DIR, 5, "no position", {
      missing: answerOfRun(await post("admin", none)),
      null: answerOfRun(await post("admin", nulled)),
    });
  });

  it("a second timesheet for the same jobseeker, position, week and pay segment is a 409; another segment or position is fine", async () => {
    const week = freshWeek();
    const steps: Record<string, unknown> = {};
    steps["first"] = answerOfRun(await post("admin", bodyFor("sin", week)));
    steps["same again"] = answerOfRun(
      await post("admin", bodyFor("sin", week))
    );
    steps["same by another role"] = answerOfRun(
      await post("bookkeeper", bodyFor("sin", week))
    );
    steps["same week, another position"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", week, { position_id: POSITION.forklift })
      )
    );
    steps["same week, another pay segment"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", week, {
          pay_split_segment: "cash",
          line_payment_method: "Cash",
        })
      )
    );
    steps["that segment again"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", week, {
          pay_split_segment: "cash",
          line_payment_method: "Cash",
        })
      )
    );
    steps["another jobseeker, same week and position"] = answerOfRun(
      await post("admin", bodyFor("cash", week))
    );
    expect((steps["same again"] as any).status).toBe(409);
    expect((steps["same week, another position"] as any).status).toBe(201);
    await pin(DIR, 6, "duplicates", steps);
  });

  it("a bulk timesheet needs no position, and a second bulk one for the same week is a 409", async () => {
    const week = freshWeek();
    const bulk = (over = {}) => {
      const b = bodyFor("sin", week, {
        is_bulk: true,
        bulk_breakdown: [
          {
            position_id: POSITION.warehouse,
            regular_hours: 40,
            total_jobseeker_pay: 800,
          },
        ],
        ...over,
      });
      delete b.position_id;
      return b;
    };
    const first = await post("admin", bulk());
    const again = await post("admin", bulk());
    const withPosition = await post(
      "admin",
      bodyFor("sin", week, { is_bulk: false })
    );
    expect(first.status, first.text).toBe(201);
    expect(again.status).toBe(409);
    await pin(DIR, 7, "bulk", {
      first: answerOfRun(first),
      again: answerOfRun(again),
      "a single timesheet in the same week": answerOfRun(withPosition),
    });
  });

  it("a body the table cannot take is a 500 that carries the database's message", async () => {
    const out: Record<string, unknown> = {};
    out["an unknown column"] = answerOfRun(
      await post("admin", bodyFor("sin", freshWeek(), { nonsense: 1 }))
    );
    out["hours that are not a number"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", freshWeek(), { total_regular_hours: "abc" })
      )
    );
    // DEV-6: no longer the database's 500 (foreign key): the profile check answers 400 before the insert
    out["a profile nobody has"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", freshWeek(), { jobseeker_profile_id: NO_SUCH_ID })
      )
    );
    out["a position nobody has"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", freshWeek(), { position_id: NO_SUCH_ID })
      )
    );
    // the table refuses a total below zero (check timesheets_pay_positive): a deduction larger than the pay cannot be saved
    out["a negative pay"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", freshWeek(), {
          total_jobseeker_pay: -480,
          deduction_amount: 500,
        })
      )
    );
    out["a negative bill"] = answerOfRun(
      await post(
        "admin",
        bodyFor("sin", freshWeek(), { total_client_bill: -1 })
      )
    );
    expect((out["a negative pay"] as any).status).toBe(500);
    await pin(DIR, 8, "the database refuses", out);
  });
});

describe("POST /api/timesheets: what the stored row keeps, exactly as sent", () => {
  it("fields left out get the server's defaults", async () => {
    const body = bodyFor("sin", freshWeek());
    for (const f of [
      "premium_pay_rate",
      "tax_amount",
      "email_sent",
      "pay_split_segment",
      "line_payment_method",
      "bonus_amount",
      "deduction_amount",
      "notes",
      "invoice_number",
    ]) {
      delete body[f];
    }
    body.notes = NOTE;
    const r = await post("admin", body);
    expect(r.status, r.text).toBe(201);
    await pin(DIR, 9, "defaults", answerOfRun(r));
  });

  it("money cases, as the screens send them: the stored totals, to the cent", async () => {
    const out: Record<string, unknown> = {};
    const send = async (name: string, body: Record<string, unknown>) => {
      const r = await post("admin", body);
      expect(r.status, `${name}: ${r.text}`).toBe(201);
      out[name] = answerOfRun(r);
    };
    // overtime position, 50 h: 40 x 20 + 10 x 30 = 1100 pay; 40 x 35 + 10 x 52.50 = 1925 bill
    await send(
      "overtime week",
      bodyFor("sin", freshWeek(), {
        position_id: POSITION.forklift,
        total_overtime_hours: 10,
        overtime_pay_rate: 30,
        overtime_bill_rate: 52.5,
        total_jobseeker_pay: 1100,
        total_client_bill: 1925,
        overtime_enabled: true,
      })
    );
    // cash with 10% off: 800 - 80 = 720
    await send(
      "cash with a deduction",
      bodyFor("cash", freshWeek(), { total_jobseeker_pay: 720 })
    );
    // hybrid SIN + cash, cap 20 h: two rows, each with the same week and its own segment
    const hybridWeek = freshWeek();
    await send(
      "hybrid, the SIN row",
      bodyFor("hybrid", hybridWeek, {
        total_regular_hours: 20,
        total_jobseeker_pay: 400,
        total_client_bill: 700,
        pay_split_segment: "sin",
        line_payment_method: "SIN-Direct Deposit",
      })
    );
    await send(
      "hybrid, the cash row",
      bodyFor("hybrid", hybridWeek, {
        total_regular_hours: 20,
        total_jobseeker_pay: 360,
        total_client_bill: 700,
        pay_split_segment: "cash",
        line_payment_method: "Cash",
      })
    );
    // hybrid SIN + e-Transfer with a bonus on the SIN row only
    const etWeek = freshWeek();
    await send(
      "hybrid e-Transfer, the SIN row with a bonus",
      bodyFor("hybridEt", etWeek, {
        position_id: POSITION.loader,
        total_regular_hours: 30,
        total_jobseeker_pay: 650,
        total_client_bill: 1050,
        bonus_amount: 50,
        pay_split_segment: "sin",
        line_payment_method: "SIN-Direct Deposit",
      })
    );
    await send(
      "hybrid e-Transfer, the e-Transfer row",
      bodyFor("hybridEt", etWeek, {
        position_id: POSITION.loader,
        total_regular_hours: 10,
        total_jobseeker_pay: 190,
        total_client_bill: 350,
        pay_split_segment: "e_transfer",
        line_payment_method: "e-Transfer",
      })
    );
    // corporation with 13% HST and a premium rate of 2.5: 40 x 22.50 = 900, tax 117, pay 1017
    await send(
      "corporation with HST",
      bodyFor("corp", freshWeek(), {
        position_id: POSITION.driver,
        premium_pay_rate: 2.5,
        total_jobseeker_pay: 1017,
        tax_amount: 117,
      })
    );
    // a bonus and a deduction on an ordinary week: 800 + 50 - 20
    await send(
      "bonus and deduction",
      bodyFor("sin", freshWeek(), {
        total_jobseeker_pay: 830,
        bonus_amount: 50,
        deduction_amount: 20,
      })
    );
    // amounts with cents, and with more digits than a cent
    await send(
      "cents",
      bodyFor("sin", freshWeek(), {
        total_regular_hours: 39.75,
        total_jobseeker_pay: 1234.57,
        total_client_bill: 2345.68,
      })
    );
    await send(
      "more digits than a cent",
      bodyFor("sin", freshWeek(), {
        total_jobseeker_pay: 199.945,
        total_client_bill: 350.046,
      })
    );
    await pin(DIR, 10, "money cases", out);
  });
});

describe("POST /api/timesheets: who may create for whom", () => {
  it("a jobseeker may not create a timesheet at all: 403, nothing is stored", async () => {
    const before = (await rowsWithNote(NOTE)).length;
    const out: Record<string, unknown> = {};
    out["own"] = answerOfRun(await post("js:sin", bodyFor("sin", freshWeek())));
    out["another jobseeker's user id and profile"] = answerOfRun(
      await post("js:sin", bodyFor("cash", freshWeek()))
    );
    out["another jobseeker's user id, own profile"] = answerOfRun(
      await post(
        "js:sin",
        bodyFor("sin", freshWeek(), { jobseeker_user_id: JOBSEEKERS.cash.id })
      )
    );
    out["the jobseeker without a profile"] = answerOfRun(
      await post("js:signup", bodyFor("sin", freshWeek()))
    );
    for (const [name, v] of Object.entries(out)) {
      expect((v as any).status, name).toBe(403);
    }
    expect((await rowsWithNote(NOTE)).length).toBe(before);
    await pin(DIR, 11, "jobseekers", out);
  });

  it("a jobseeker's own user id with another jobseeker's profile id is refused (inbox 66): 403, nothing is stored", async () => {
    const before = (await rowsWithNote(NOTE)).length;
    const r = await post(
      "js:sin",
      bodyFor("cash", freshWeek(), { jobseeker_user_id: JOBSEEKERS.sin.id })
    );
    expect(r.status, r.text).toBe(403);
    expect((await rowsWithNote(NOTE)).length).toBe(before);
    await pin(DIR, 12, "own user id, another profile", answerOfRun(r));
  });

  it("a staff account cannot create a row whose user id and profile belong to two different people: 400, nothing is stored", async () => {
    const before = (await rowsWithNote(NOTE)).length;
    const week = freshWeek(); // both are refused, so the same week
    const mismatched = await post(
      "admin",
      bodyFor("cash", week, { jobseeker_user_id: JOBSEEKERS.sin.id })
    );
    expect(mismatched.status, mismatched.text).toBe(400);
    const nobody = await post(
      "admin",
      bodyFor("sin", week, { jobseeker_profile_id: NO_SUCH_ID })
    );
    expect(nobody.status, nobody.text).toBe(400);
    expect((await rowsWithNote(NOTE)).length).toBe(before);
    await pin(DIR, 13, "staff, mismatched user and profile", {
      "user id of one jobseeker, profile of another": answerOfRun(mismatched),
      "a profile nobody has": answerOfRun(nobody),
    });
  });
});

describe("POST /api/timesheets: messages", () => {
  it("email_sent true sends the jobseeker one email, after the answer; email_sent false sends none", async () => {
    const before = emailsSent().length;
    const quiet = await post("admin", bodyFor("sin", freshWeek()));
    expect(quiet.status).toBe(201);
    expect(await newEmails(before, 0)).toEqual([]);

    const loud = await post(
      "admin",
      bodyFor("sin", freshWeek(), { email_sent: true })
    );
    expect(loud.status, loud.text).toBe(201);
    const sent = await newEmails(before, 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["jobseeker.sin@example.test"]);
    await pin(DIR, 14, "the create email", {
      answer: answerOfRun(loud),
      messages: sent.map(mailOf),
    });
    // the message is recorded; nothing left the machine (the outbound guard refuses every other socket)
    expect(settled(emailsSent().length - before)).toBe(1);
  });
});

describe("POST /api/timesheets: matching ids, later in the file so the weeks of the pins above do not move", () => {
  it("a staff account may create a row for any jobseeker when the user id and the profile match", async () => {
    for (const who of ["cash", "hybrid", "corp"] as const) {
      const r = await post("admin", bodyFor(who, freshWeek()));
      expect(r.status, `${who}: ${r.text}`).toBe(201);
      expect(r.json.timesheet.jobseeker_user_id).toBe(JOBSEEKERS[who].id);
      expect(r.json.timesheet.jobseeker_profile_id).toBe(PROFILE[who]);
    }
  });
});
