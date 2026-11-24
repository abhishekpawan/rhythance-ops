// API pins for DELETE /api/timesheets/:id and PATCH /api/timesheets/:id/document (R-4, recorded on the code as it is,
// before the split).
//
// Who may call them, worked out from the routes: `authorizeRoles(["admin", "recruiter", "jobseeker"])` lets all nine
// accounts through; a jobseeker reaches only rows with their own user id (another's row is "not found", 404, and
// stays). Every row below is made by this file (notes start with R4-PIN) and removed in `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOBSEEKERS, STAFF } from "../support/api";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  call,
  generic,
  make,
  stampless,
  NO_SUCH_ID,
  rowOf,
  sweep,
} from "./timesheet-helpers";

const DIR = "api-timesheets-delete-document";
beforeAll(sweep);
afterAll(sweep);

const del = (who: Parameters<typeof call>[0], id: string) =>
  call(who, `/api/timesheets/${id}`, { method: "DELETE" });
const patchDoc = (who: Parameters<typeof call>[0], id: string, body: unknown) =>
  call(who, `/api/timesheets/${id}/document`, { method: "PATCH", body });

describe("DELETE /api/timesheets/:id", () => {
  it("each staff account deletes a row and a jobseeker deletes their own; the answer names the row and it is gone", async () => {
    const out: Record<string, unknown> = {};
    for (const role of [...STAFF_ROLES, "js:sin"] as const) {
      const row = await make("admin", "sin");
      const r = await del(role, row.id);
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      expect(r.json.deleted_id).toBe(row.id);
      expect(await rowOf(row.id), role).toBeNull();
      out[role] = {
        status: r.status,
        answer: { ...r.json, deleted_id: "<id>" },
      };
    }
    for (const [role, v] of Object.entries(out)) {
      expect(v, role).toEqual(out.admin);
    }
    await pin(DIR, 1, "delete, the same from every role", {
      roles: [...STAFF_ROLES, "jobseeker (their own)"],
      ...(out.admin as object),
    });
  });

  it("a row that is already gone, one that was never there and an id that is not an id are 404", async () => {
    const row = await make("admin", "sin");
    await del("admin", row.id);
    await pin(DIR, 2, "nothing to delete", {
      "the same row again": answerOfRun(await del("admin", row.id)),
      "an id nobody has": answerOfRun(await del("admin", NO_SUCH_ID)),
      "an id that is not a uuid": answerOfRun(await del("admin", "not-an-id")),
    });
  });

  it("a jobseeker cannot delete another jobseeker's row: 404, and the row stays", async () => {
    const casey = await make("admin", "cash");
    const r = await del("js:sin", casey.id);
    expect(r.status).toBe(404);
    expect(await rowOf(casey.id)).not.toBeNull();
    const signup = await del("js:signup", casey.id);
    expect(signup.status).toBe(404);
    await pin(DIR, 3, "jobseeker, another's row", {
      "another jobseeker": answerOfRun(r),
      "the jobseeker without a profile": answerOfRun(signup),
    });
  });

  it("a deleted row takes its hybrid partner with it only if asked: the other row stays", async () => {
    const first = await make("admin", "hybrid", {
      pay_split_segment: "sin",
      line_payment_method: "SIN-Direct Deposit",
    });
    const second = await make(
      "admin",
      "hybrid",
      { pay_split_segment: "cash", line_payment_method: "Cash" },
      { start: first.week_start_date, end: first.week_end_date }
    );
    expect((await del("admin", first.id)).status).toBe(200);
    expect(await rowOf(second.id)).not.toBeNull();
  });

  it("no token is 401, a bad token 403, and the row stays", async () => {
    const row = await make("admin", "sin");
    await pin(
      DIR,
      4,
      "without a token",
      await noTokenAnswers(`/api/timesheets/${row.id}`, { method: "DELETE" })
    );
    expect(await rowOf(row.id)).not.toBeNull();
  });
});

describe("PATCH /api/timesheets/:id/document", () => {
  it("each staff account sets the document and a jobseeker sets their own; the history gets no new entry", async () => {
    // `version` is left out of what is stored: migration 005's trigger counts every update (2 here), but that trigger
    // is on no production database (rhythence-hq/refactor/PLAN.md, finding 1), where a document change leaves it at 1.
    const noVersion = (t: Record<string, any>) => {
      const { version, ...rest } = t;
      return rest;
    };
    const out: Record<string, unknown> = {};
    let admin: unknown;
    for (const role of [...STAFF_ROLES, "js:sin"] as const) {
      const row = await make("admin", "sin");
      const r = await patchDoc(role, row.id, { document: "R4-PIN document" });
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const t = r.json.timesheet;
      const me = role === "js:sin" ? JOBSEEKERS.sin.id : STAFF[role].id;
      expect(t.document).toBe("R4-PIN document");
      expect(t.updated_by_user_id).toBe(me);
      expect(t.version_history).toHaveLength(1);
      out[role] = { status: r.status, row: generic(noVersion(t)) };
      if (role === "admin")
        admin = stampless({
          status: r.status,
          answer: { ...r.json, timesheet: noVersion(t) },
        });
    }
    for (const [role, v] of Object.entries(out)) {
      expect(v, role).toEqual(out.admin);
    }
    await pin(DIR, 5, "set the document as the admin", admin);
    await pin(DIR, 6, "the row after, the same from every role", {
      roles: [...STAFF_ROLES, "jobseeker (their own)"],
      ...(out.admin as object),
    });
  });

  it("the document must be a non-empty string", async () => {
    const row = await make("admin", "sin");
    const out: Record<string, unknown> = {};
    for (const [name, body] of Object.entries({
      "no body": undefined,
      "no document": {},
      "an empty string": { document: "" },
      "a number": { document: 5 },
      null: { document: null },
      "an object": { document: { path: "x" } },
    })) {
      out[name] = answerOfRun(await patchDoc("admin", row.id, body));
    }
    expect((await rowOf(row.id)).document).toBeNull();
    await pin(DIR, 7, "document validation", out);
  });

  it("who may set whose: a jobseeker's own, not another's; a row that is not there is a 404", async () => {
    const casey = await make("admin", "cash");
    const out = {
      "jobseeker, another's row": answerOfRun(
        await patchDoc("js:sin", casey.id, { document: "x" })
      ),
      "an id nobody has": answerOfRun(
        await patchDoc("admin", NO_SUCH_ID, { document: "x" })
      ),
      "an id that is not a uuid": answerOfRun(
        await patchDoc("admin", "not-an-id", { document: "x" })
      ),
    };
    expect(out["jobseeker, another's row"].status).toBe(404);
    expect((await rowOf(casey.id)).document).toBeNull();
    await pin(DIR, 8, "document, who may and may not", out);
  });

  it("no token is 401, a bad token 403", async () => {
    const row = await make("admin", "sin");
    await pin(
      DIR,
      9,
      "document without a token",
      await noTokenAnswers(`/api/timesheets/${row.id}/document`, {
        method: "PATCH",
        body: { document: "x" },
      })
    );
    expect((await rowOf(row.id)).document).toBeNull();
  });
});
