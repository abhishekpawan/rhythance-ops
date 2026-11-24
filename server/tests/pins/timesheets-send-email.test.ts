// API pins for POST /api/timesheets/send-email/:id (R-4, recorded on the code as it is, before the split).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter"])` lets the eight staff accounts
// through and refuses a jobseeker with a 403 before the row is looked at, their own rows included (DEV-6, inbox 66;
// before it a jobseeker could send their own row's email). The message goes to the jobseeker's billing email, or their email when
// they have no billing email (no seeded profile has one, so every message below goes to the jobseeker's own address).
// The outbound recorder holds what would have been sent: the pins assert it (who, the subject, that html and text were
// built), and nothing leaves the machine. The SendGrid stand-in never fails, so the "email could not be sent" answer
// (500, `email_sent` stays false) is not reachable here and is not pinned.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  call,
  emailsSent,
  make,
  mailOf,
  newEmails,
  NO_SUCH_ID,
  rowOf,
  sweep,
} from "./timesheet-helpers";

const DIR = "api-timesheets-send-email";
beforeAll(sweep);
afterAll(sweep);

const send = (who: Parameters<typeof call>[0], id: string) =>
  call(who, `/api/timesheets/send-email/${id}`, { method: "POST" });

describe("POST /api/timesheets/send-email/:id", () => {
  it("each staff account sends it: one message, the flag is set", async () => {
    const out: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const row = await make("admin", "sin", { invoice_number: "800100" });
      const before = emailsSent().length;
      const r = await send(role, row.id);
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const sent = await newEmails(before, 1);
      expect(sent, role).toHaveLength(1);
      expect(sent[0].to).toEqual(["jobseeker.sin@example.test"]);
      expect((await rowOf(row.id)).email_sent, role).toBe(true);
      out[role] = {
        status: r.status,
        answer: r.json,
        message: mailOf(sent[0]),
      };
    }
    // a jobseeker is refused on their own row: nothing sent, the flag stays off (DEV-6)
    const mine = await make("admin", "sin", { invoice_number: "800100" });
    const beforeRefused = emailsSent().length;
    const refused = await send("js:sin", mine.id);
    expect(refused.status, refused.text).toBe(403);
    expect(await newEmails(beforeRefused, 0)).toEqual([]);
    expect((await rowOf(mine.id)).email_sent).toBe(false);

    for (const [role, v] of Object.entries(out)) {
      expect(v, role).toEqual(out.admin);
    }
    await pin(DIR, 1, "the send, the same from every role", {
      roles: [...STAFF_ROLES],
      ...(out.admin as object),
    });
  });

  it("the message of each seeded kind of payment is built from the stored row", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, who, over] of [
      ["cash", "cash", { total_jobseeker_pay: 720 }],
      [
        "overtime",
        "sin",
        {
          total_overtime_hours: 10,
          overtime_pay_rate: 30,
          overtime_enabled: true,
          total_jobseeker_pay: 1100,
        },
      ],
      ["corporation", "corp", { tax_amount: 117, total_jobseeker_pay: 1017 }],
    ] as const) {
      const row = await make("admin", who, {
        invoice_number: "800101",
        ...over,
      });
      const before = emailsSent().length;
      const r = await send("admin", row.id);
      expect(r.status, r.text).toBe(200);
      const sent = await newEmails(before, 1);
      out[name] = { answer: answerOfRun(r), message: mailOf(sent[0]) };
    }
    await pin(DIR, 2, "messages by kind of payment", out);
  });

  it("a jobseeker cannot send for any row, theirs or another's: 403, nothing sent, the flag stays off", async () => {
    const casey = await make("admin", "cash");
    const sam = await make(
      "admin",
      "sin",
      {},
      { start: casey.week_start_date, end: casey.week_end_date }
    ); // same week: keeps the later weeks where they were
    const before = emailsSent().length;
    const r = await send("js:sin", casey.id);
    expect(r.status).toBe(403);
    const own = await send("js:sin", sam.id);
    expect(own.status).toBe(403);
    expect(await newEmails(before, 0)).toEqual([]);
    expect((await rowOf(casey.id)).email_sent).toBe(false);
    expect((await rowOf(sam.id)).email_sent).toBe(false);
    await pin(DIR, 3, "jobseeker, another's row", {
      "another's row": answerOfRun(r),
      "their own row": answerOfRun(own),
    });
  });

  it("a row that is not there, or an id that is not an id, is a 404 for staff (a jobseeker gets 403) and nothing is sent", async () => {
    const before = emailsSent().length;
    const out = {
      "an id nobody has": answerOfRun(await send("admin", NO_SUCH_ID)),
      "an id that is not a uuid": answerOfRun(await send("admin", "not-an-id")),
      "a jobseeker, an id nobody has": answerOfRun(
        await send("js:sin", NO_SUCH_ID)
      ),
    };
    expect(await newEmails(before, 0)).toEqual([]);
    await pin(DIR, 4, "nothing to send", out);
  });

  it("sending again sends again (nothing stops a second message)", async () => {
    const row = await make("admin", "sin");
    const before = emailsSent().length;
    expect((await send("admin", row.id)).status).toBe(200);
    expect((await send("admin", row.id)).status).toBe(200);
    expect(await newEmails(before, 2)).toHaveLength(2);
  });

  it("no token is 401, a bad token 403, and nothing is sent", async () => {
    const row = await make("admin", "sin");
    const before = emailsSent().length;
    await pin(
      DIR,
      5,
      "without a token",
      await noTokenAnswers(`/api/timesheets/send-email/${row.id}`, {
        method: "POST",
      })
    );
    expect(await newEmails(before, 0)).toEqual([]);
  });
});
