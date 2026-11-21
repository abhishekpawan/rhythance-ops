// API pins for the five dropdown option endpoints (server/src/routes/dropdownOptions.ts), recorded on the code as it is (R-3).
//
// Who may call what, worked out from the route: the two reads need `authorizeRoles(["admin", "recruiter"])`, and
// `hasAccessRole` lets every account with a staff role through for "recruiter" (recruiter, bookkeeper, recruiter manager,
// accountant manager, sales, recruiter director) and an account of user type "admin" (the admin and the super admin) for
// "admin". So all eight staff accounts may read and only the jobseeker is refused. The three writes need
// `authorizeRoles(["admin"])`: the admin and the super admin; the six recruiter-type accounts and the jobseeker get 403.
//
// Writes only touch rows this file makes (names starting "Pin Test"); the seeded options are never changed, and the
// rows made are removed at the end and again in `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stack, supabase } from "../support/api";
import {
  as,
  everyRole,
  noTokenAnswers,
  pin,
  ROLES,
  STAFF_ROLES,
  type Role,
} from "./module-helpers";

const DIR = "api-dropdown-options";
const READERS: Role[] = [...STAFF_ROLES];
const WRITERS: Role[] = ["admin", "superadmin"];
const NOT_WRITERS = ROLES.filter((r) => !WRITERS.includes(r));
const BASE = "/api/dropdown-options";

const clean = async () => {
  const s = stack();
  const r = await supabase(
    `/rest/v1/client_dropdown_options?name=like.Pin%20Test*`,
    {
      method: "DELETE",
      token: s.serviceKey,
      key: s.serviceKey,
      headers: { Prefer: "return=minimal" },
    }
  );
  expect(r.status, r.text).toBeLessThan(300);
};
beforeAll(clean);
afterAll(clean);

/**
 * Rows with the same display order and name (the same name in two lists) come back in no fixed order: the query sorts by
 * those two only. Checks the two-column order, then puts equal pairs in a fixed order so a coin toss does not fail a pin.
 */
function settleOrder(rows: any[]) {
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1], rows[i]];
    const inOrder =
      a.display_order < b.display_order ||
      (a.display_order === b.display_order && a.name <= b.name);
    expect(inOrder, `row ${i}: ${a.name} then ${b.name}`).toBe(true);
  }
  return [...rows].sort(
    (a, b) =>
      a.display_order - b.display_order ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.list_type < b.list_type ? -1 : 1)
  );
}

const tidy = (answer: any) =>
  Array.isArray(answer) ? settleOrder(answer) : answer;

/** The same read as every account; the allowed ones must agree (after ties are put in order), the rest are stored per role. */
const readAnswer = async (path: string) => {
  const all = await everyRole(path);
  const sorted = (role: Role) => ({
    ...all[role],
    answer: tidy(all[role].answer),
  });
  for (const role of READERS)
    expect(sorted(role), role).toEqual(sorted(READERS[0]));
  const refused: Record<string, unknown> = {};
  for (const role of ROLES.filter((r) => !READERS.includes(r)))
    refused[role] = all[role];
  return { allowed: [...READERS], answer: sorted(READERS[0]), refused };
};

describe("GET /api/dropdown-options", () => {
  it("every staff account reads the same list; a jobseeker is refused", async () => {
    // the answers of the allowed roles are compared before sorting ties, so compare after: sort each
    const out = await readAnswer(BASE);
    expect(Object.keys(out.refused)).toEqual(["jobseeker"]);
    expect(out.answer.status).toBe(200);
    await pin(DIR, 1, "the whole list by role", out);
  });
  it("filtered by list type, and an unknown type is ignored (the whole list)", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, query] of [
      ["accounting manager", "?listType=accounting_manager"],
      ["subcategory position", "?listType=subcategory_position"],
      ["unknown type", "?listType=nope"],
      ["empty type", "?listType="],
    ] as const) {
      const r = await as("recruiter", `${BASE}${query}`);
      out[name] = { status: r.status, answer: tidy(r.json) };
    }
    expect((out["unknown type"] as any).answer.length).toBe(
      (await as("admin", BASE)).json.length
    );
    await pin(DIR, 2, "filters", out);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(DIR, 3, "list without a token", await noTokenAnswers(BASE));
  });
});

describe("GET /api/dropdown-options/:listType", () => {
  it("each of the eight list types, and an unknown one is 400", async () => {
    const out: Record<string, unknown> = {};
    for (const t of [
      "client_manager",
      "client_representative",
      "salesperson",
      "accounting_person",
      "accounting_manager",
      "position_title",
      "list_name",
      "subcategory_position",
      "nope",
    ]) {
      const r = await as("admin", `${BASE}/${t}`);
      out[t] = { status: r.status, answer: tidy(r.json) };
    }
    expect((out.nope as any).status).toBe(400);
    await pin(DIR, 4, "by list type", out);
  });
  it("every staff account reads the same; a jobseeker is refused", async () => {
    const out = await readAnswer(`${BASE}/salesperson`);
    expect(Object.keys(out.refused)).toEqual(["jobseeker"]);
    await pin(DIR, 5, "one type by role", out);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      6,
      "by type without a token",
      await noTokenAnswers(`${BASE}/salesperson`)
    );
  });
});

describe("POST, PUT and DELETE (admin and super admin)", () => {
  const count = async () =>
    (await as("admin", `${BASE}/client_manager`)).json.length as number;

  it("create, update, duplicate and delete one option", async () => {
    const steps: Array<{ step: string; status: number; answer: unknown }> = [];
    const go = async (
      step: string,
      role: Role,
      method: string,
      path: string,
      body?: unknown
    ) => {
      const r = await as(role, path, { method, body });
      steps.push({ step, status: r.status, answer: r.json ?? r.text });
      return r;
    };
    const start = await count();
    const made = await go("create", "admin", "POST", BASE, {
      listType: "client_manager",
      name: "  Pin Test One  ",
      displayOrder: 7,
    });
    expect(made.status).toBe(201);
    expect(made.json).toMatchObject({
      list_type: "client_manager",
      name: "Pin Test One",
      display_order: 7,
    });
    const id = made.json.id as string;
    expect(await count()).toBe(start + 1);
    // the same name in another list is fine; the same name in the same list is 409
    const other = await go(
      "same name, another list",
      "superadmin",
      "POST",
      BASE,
      { listType: "salesperson", name: "Pin Test One" }
    );
    expect(other.status).toBe(201);
    await go("same name, same list", "admin", "POST", BASE, {
      listType: "client_manager",
      name: "Pin Test One",
    });
    await go(
      "no display order is 0, a text order is 0",
      "admin",
      "POST",
      BASE,
      { listType: "client_manager", name: "Pin Test Two", displayOrder: "3" }
    );
    await go("rename", "superadmin", "PUT", `${BASE}/${id}`, {
      name: " Pin Test Renamed ",
    });
    await go("change the order only", "admin", "PUT", `${BASE}/${id}`, {
      displayOrder: 2,
    });
    await go("a text order is ignored", "admin", "PUT", `${BASE}/${id}`, {
      displayOrder: "9",
    });
    await go("nothing to change", "admin", "PUT", `${BASE}/${id}`, {});
    await go("rename to a name the list has", "admin", "PUT", `${BASE}/${id}`, {
      name: "Pin Test Two",
    });
    await go("rename to empty", "admin", "PUT", `${BASE}/${id}`, {
      name: "  ",
    });
    await go(
      "a list type in the body is ignored",
      "admin",
      "PUT",
      `${BASE}/${id}`,
      { listType: "salesperson", name: "Pin Test Moved" }
    );
    const read = await as("admin", `${BASE}/client_manager`);
    expect(read.json.map((o: any) => o.name)).toContain("Pin Test Moved");
    await go("delete", "superadmin", "DELETE", `${BASE}/${id}`);
    expect(await count()).toBe(start + 1); // Pin Test Two is still there
    await go("delete again", "admin", "DELETE", `${BASE}/${id}`);
    await pin(DIR, 7, "write steps", steps);
  });

  it("validation of POST", async () => {
    const out: Record<string, { status: number; answer: unknown }> = {};
    const start = await count();
    const go = async (name: string, body: unknown) => {
      const r = await as("admin", BASE, { method: "POST", body });
      out[name] = { status: r.status, answer: r.json ?? r.text };
    };
    await go("no body", undefined);
    await go("no list type", { name: "Pin Test X" });
    await go("no name", { listType: "client_manager" });
    await go("blank name", { listType: "client_manager", name: "   " });
    await go("unknown list type", { listType: "nope", name: "Pin Test X" });
    await go("name is a number", { listType: "client_manager", name: 5 });
    expect(await count()).toBe(start);
    await pin(DIR, 8, "post validation", out);
  });

  it("an unknown id and an id that is not an id", async () => {
    const out: Record<string, { status: number; answer: unknown }> = {};
    const go = async (
      name: string,
      method: string,
      id: string,
      body?: unknown
    ) => {
      const r = await as("admin", `${BASE}/${id}`, { method, body });
      out[name] = { status: r.status, answer: r.json ?? r.text };
    };
    const nobody = "00000000-0000-4000-8000-0000000000ff";
    await go("put an unknown id", "PUT", nobody, { name: "Pin Test Nobody" });
    await go("delete an unknown id", "DELETE", nobody);
    await go("put a text id", "PUT", "not-an-id", { name: "Pin Test Nobody" });
    await go("delete a text id", "DELETE", "not-an-id");
    await pin(DIR, 9, "unknown ids", out);
  });

  it("nobody but the admin and the super admin may write, and nothing changes", async () => {
    const out: Record<string, unknown> = {};
    // a row of this file's own, so a refusal that failed to refuse could not touch a seeded option
    const made = await as("admin", BASE, {
      method: "POST",
      body: { listType: "client_manager", name: "Pin Test Target" },
    });
    expect(made.status).toBe(201);
    const seeded = made.json.id as string;
    const start = await count();
    for (const role of NOT_WRITERS) {
      const post = await as(role, BASE, {
        method: "POST",
        body: { listType: "client_manager", name: "Pin Test Refused" },
      });
      const put = await as(role, `${BASE}/${seeded}`, {
        method: "PUT",
        body: { name: "Pin Test Refused" },
      });
      const del = await as(role, `${BASE}/${seeded}`, { method: "DELETE" });
      out[role] = {
        post: [post.status, post.json],
        put: [put.status, put.json],
        delete: [del.status, del.json],
      };
      expect([post.status, put.status, del.status], role).toEqual([
        403, 403, 403,
      ]);
    }
    expect(await count()).toBe(start);
    expect(
      (await as("admin", `${BASE}/client_manager`)).json.map((o: any) => o.name)
    ).not.toContain("Pin Test Refused");
    out.noToken = {
      post: await noTokenAnswers(BASE, {
        method: "POST",
        body: { listType: "client_manager", name: "Pin Test Refused" },
      }),
      put: await noTokenAnswers(`${BASE}/${seeded}`, {
        method: "PUT",
        body: { name: "Pin Test Refused" },
      }),
      delete: await noTokenAnswers(`${BASE}/${seeded}`, { method: "DELETE" }),
    };
    expect(await count()).toBe(start);
    const target = (await as("admin", `${BASE}/client_manager`)).json.find(
      (o: any) => o.id === seeded
    );
    expect(target.name).toBe("Pin Test Target");
    await as("admin", `${BASE}/${seeded}`, { method: "DELETE" });
    await pin(DIR, 10, "writes by other roles", out);
  });
});
