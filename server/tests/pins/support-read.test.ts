// API pins for the three read endpoints of server/src/routes/support/ (D4.2 / SESSIONS.md R-2): the ticket list, one
// ticket, and the signed download link of an attachment. Each is asked as every account (eight staff roles and a
// jobseeker, who may not use Support at all) and the answers are stored together, per case.
//
// They read the five seeded tickets (tests/seed/data.sql, ids in tests/seed/ids.mjs), whose dates are fixed, on the
// server whose clock stands still. Tests that make tickets run elsewhere; this file first removes any they left.
import { beforeAll, describe, expect, it } from "vitest";
import { SUPPORT, SUPPORT_ATTACHMENTS } from "../seed/ids.mjs";
import {
  as,
  BASE,
  everyRole,
  pin,
  removeRunTimeTickets,
  ROLES,
  STAFF_ROLES,
} from "./support-helpers";

beforeAll(removeRunTimeTickets);

const fixed = { fixedClock: true };

describe("GET /api/support/tickets", () => {
  const E = "tickets list";
  const cases: Array<[string, string]> = [
    ["default is my tickets", ""],
    ["scope all", "?scope=all"],
    ["scope mine written out", "?scope=mine"],
    ["scope all, status resolved", "?scope=all&status=resolved"],
    ["scope all, status in progress", "?scope=all&status=in_progress"],
    ["scope all, a status nobody has", "?scope=all&status=bogus"],
    ["scope all, two per page, page 2", "?scope=all&limit=2&page=2"],
    ["scope all, page past the end", "?scope=all&limit=2&page=9"],
    ["limit and page out of range are clamped", "?scope=all&limit=500&page=0"],
    ["an unknown scope is mine", "?scope=everything"],
  ];
  cases.forEach(([name, query], i) =>
    it(name, async () => {
      await pin(
        E,
        i + 1,
        name,
        await everyRole(`${BASE}/tickets${query}`, fixed)
      );
    })
  );

  it("who may see what, in one line each", async () => {
    // worked out from the route and src/services/support.permissions.ts, not from the answers:
    // everyone but a jobseeker may list; "all" works for agents (super admin) and shared viewers (admin and the
    // three recruiter roles); every other role gets its own tickets whatever scope it asks for.
    const seen: Record<string, number[]> = {};
    for (const role of ROLES) {
      const r = await as(role, `${BASE}/tickets?scope=all`, fixed);
      seen[role] =
        r.status === 200
          ? r.json.tickets.map((t: any) => t.ticketNumber).sort()
          : [r.status];
    }
    const every = [1, 2, 3, 4, 5];
    expect(seen).toEqual({
      admin: every,
      superadmin: every,
      recruiter: every,
      bookkeeper: [2],
      recruiter_manager: every,
      accountant_manager: [5],
      sales: [4],
      recruiter_director: every,
      jobseeker: [404],
    });
  });

  it("no token is 401 and a bad token 403", async () => {
    const anon = await as("admin", `${BASE}/tickets`, { token: "anon" });
    expect([anon.status, anon.json]).toEqual([
      401,
      { error: "Missing authentication token" },
    ]);
    const bad = await as("admin", `${BASE}/tickets`, { token: "bad" });
    expect([bad.status, bad.json]).toEqual([
      403,
      { error: "Invalid or expired token" },
    ]);
  });
});

describe("GET /api/support/tickets/:id", () => {
  const E = "ticket get";
  Object.entries(SUPPORT).forEach(([name, t], i) =>
    it(`seeded ticket ${t.number} (${name})`, async () => {
      await pin(
        E,
        i + 1,
        `ticket ${t.number} ${name}`,
        await everyRole(`${BASE}/tickets/${t.id}`, fixed)
      );
    })
  );

  it("an id that is not a ticket", async () => {
    const answers = {
      "not a uuid": await everyRole(`${BASE}/tickets/12345`, fixed, ["admin"]),
      "a uuid nobody has": await everyRole(
        `${BASE}/tickets/00000000-0000-4000-8000-00000000ffff`,
        fixed,
        ["admin", AGENT_ROLE]
      ),
    };
    await pin(E, 6, "an id that is not a ticket", answers);
  });

  it("the internal note and its file reach the agent only; shared viewers and the owner never see them", async () => {
    // worked out from the route, not from the stored answers
    for (const role of STAFF_ROLES) {
      const r = await as(
        role,
        `${BASE}/tickets/${SUPPORT.recruiterBug.id}`,
        fixed
      );
      const owner = role === "recruiter";
      const mayOpen = [
        "admin",
        "superadmin",
        "recruiter",
        "recruiter_manager",
        "recruiter_director",
      ].includes(role);
      expect(r.status, role).toBe(mayOpen ? 200 : 404);
      if (!mayOpen) continue;
      const internal = r.json.messages.filter((m: any) => m.isInternal);
      const files = r.json.attachments.map((a: any) => a.id);
      if (role === "superadmin") {
        expect(internal).toHaveLength(1);
        expect(files).toEqual([
          SUPPORT_ATTACHMENTS.onDescription.id,
          SUPPORT_ATTACHMENTS.onInternalNote.id,
        ]);
      } else {
        expect(r.json.messages).toHaveLength(2);
        expect(r.json.messages.some((m: any) => "isInternal" in m)).toBe(false);
        // files: only the owner and admins see any; the note's file never
        expect(files).toEqual(
          owner || role === "admin"
            ? [SUPPORT_ATTACHMENTS.onDescription.id]
            : []
        );
      }
    }
  });

  it("no token is 401 and a bad token 403", async () => {
    const path = `${BASE}/tickets/${SUPPORT.recruiterBug.id}`;
    expect((await as("admin", path, { token: "anon" })).status).toBe(401);
    expect((await as("admin", path, { token: "bad" })).status).toBe(403);
  });
});

describe("GET /api/support/attachments/:id/url", () => {
  const E = "attachment url";
  const ONE = SUPPORT_ATTACHMENTS.onDescription.id;
  const NOTE = SUPPORT_ATTACHMENTS.onInternalNote.id;

  it("the file on the first message", async () => {
    const all = await everyRole(`${BASE}/attachments/${ONE}/url`, fixed);
    await pin(E, 1, "file on the first message", all);
    // owner (recruiter), every admin and the agent get a link; nobody else, a jobseeker included
    for (const role of ROLES)
      expect(all[role].status, role).toBe(
        ["recruiter", "admin", "superadmin"].includes(role) ? 200 : 404
      );
  });

  it("the file on the internal note", async () => {
    const all = await everyRole(`${BASE}/attachments/${NOTE}/url`, fixed);
    await pin(E, 2, "file on the internal note", all);
    // the agent only: not the owner, not an admin
    for (const role of ROLES)
      expect(all[role].status, role).toBe(role === "superadmin" ? 200 : 404);
  });

  it("an id that is not an attachment", async () => {
    await pin(E, 3, "an id that is not an attachment", {
      "not a uuid": await everyRole(`${BASE}/attachments/abc/url`, fixed, [
        "admin",
      ]),
      "a uuid nobody has": await everyRole(
        `${BASE}/attachments/00000000-0000-4000-8000-00000000ffff/url`,
        fixed,
        ["admin"]
      ),
    });
  });

  it("the link points at the file's own place in the private bucket and expires", async () => {
    const r = await as("admin", `${BASE}/attachments/${ONE}/url`, fixed);
    expect(r.json.url).toMatch(
      new RegExp(
        `/storage/v1/object/sign/support-attachments/${SUPPORT.recruiterBug.id}/screenshot-error\\.pdf\\?token=`
      )
    );
    const link = await fetch(r.json.url);
    expect(link.status).toBe(200);
    expect((await link.text()).startsWith("%PDF")).toBe(true);
  });

  it("no token is 401 and a bad token 403", async () => {
    const path = `${BASE}/attachments/${ONE}/url`;
    expect((await as("admin", path, { token: "anon" })).status).toBe(401);
    expect((await as("admin", path, { token: "bad" })).status).toBe(403);
  });
});

const AGENT_ROLE = "superadmin" as const;
