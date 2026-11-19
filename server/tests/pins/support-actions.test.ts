// API pins for the three status endpoints of server/src/routes/support/ticketActions.ts: confirm that a resolved ticket is
// fixed (owner only), reopen (owner or agent), and the agent's change of status, priority, title, assignee and hours
// (PATCH). Every account tries each; then the transitions the database allows and refuses.
//
// Every test makes its own tickets, as accounts the other support pin files do not use up (the server's hourly
// allowances are shared: see `as` in support-helpers.ts). `result(n)`: n is every support message the whole run made
// the server send, the ones that set the scene included: a new ticket tells the support address; a ticket becoming
// "waiting on client" or "resolved" tells the requester; the owner reopening tells the support address; confirming,
// an agent reopening, and the other statuses tell nobody.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  as,
  BASE,
  pin,
  ROLES,
  Scenario,
  serviceUpdate,
  type Role,
} from "./support-helpers";

const post = { method: "POST" };
const patch = (body: unknown) => ({ method: "PATCH", body });

describe("POST /api/support/tickets/:id/confirm", () => {
  const E = "ticket confirm";

  it("only the owner, only once the ticket is resolved", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter_manager");
    const url = `${BASE}/tickets/${t.id}/confirm`;
    for (const role of ROLES)
      await sc.call(`while open, as ${role}`, role, url, post);
    await sc.agentSets(t.id, { status: "resolved" });
    for (const role of ROLES.filter((r) => r !== "recruiter_manager"))
      await sc.call(`when resolved, as ${role}`, role, url, post);
    await sc.call(
      "when resolved, as the owner",
      "recruiter_manager",
      url,
      post
    );
    await sc.call(
      "again, now closed, as the owner",
      "recruiter_manager",
      url,
      post
    );
    await sc.call(
      "the ticket afterwards, to the agent",
      "superadmin",
      `${BASE}/tickets/${t.id}`
    );
    const result = await sc.result(2); // the new ticket, then "resolved" to the requester
    // worked out from the route: 404 for everybody who does not own the ticket (the agent and every admin too);
    // the owner gets 400 until it is resolved, then 200 once; the second time it is closed and not resolved: 400
    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    for (const role of ROLES) {
      expect(status(`while open, as ${role}`), role).toBe(
        role === "recruiter_manager" ? 400 : 404
      );
      if (role !== "recruiter_manager")
        expect(status(`when resolved, as ${role}`), role).toBe(404);
    }
    expect(status("when resolved, as the owner")).toBe(200);
    expect(status("again, now closed, as the owner")).toBe(400);
    const last = sc.steps[sc.steps.length - 1].answer as any;
    expect([last.ticket.status, last.ticket.confirmedBy]).toEqual([
      "closed",
      "client",
    ]);
    await pin(E, 1, "owner only, resolved only", result);
  });

  it("an id that is not a ticket", async () => {
    const sc = new Scenario();
    await sc.call(
      "not a uuid",
      "recruiter",
      `${BASE}/tickets/abc/confirm`,
      post
    );
    await sc.call(
      "a uuid nobody has",
      "recruiter",
      `${BASE}/tickets/${randomUUID()}/confirm`,
      post
    );
    await pin(E, 2, "an id that is not a ticket", await sc.result(0));
  });

  it("no token is 401 and a bad token 403", async () => {
    const url = `${BASE}/tickets/00000000-0000-4000-8000-000000001002/confirm`;
    expect((await as("admin", url, { ...post, token: "anon" })).status).toBe(
      401
    );
    expect((await as("admin", url, { ...post, token: "bad" })).status).toBe(
      403
    );
  });
});

describe("POST /api/support/tickets/:id/reopen", () => {
  const E = "ticket reopen";

  it("a resolved ticket, by the owner and by the agent, with and without a reason", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter_manager");
    const url = `${BASE}/tickets/${t.id}/reopen`;
    const owner: Role = "recruiter_manager";
    for (const role of ROLES)
      await sc.call(`while open, as ${role}`, role, url, post);
    await sc.agentSets(t.id, { status: "resolved" });
    for (const role of ROLES.filter((r) => r !== owner && r !== "superadmin"))
      await sc.call(`when resolved, as ${role}`, role, url, post);
    await sc.call("the owner, with a reason", owner, url, {
      ...post,
      body: { body: "It is not fixed" },
    });
    await sc.agentSets(t.id, { status: "resolved" });
    await sc.call("the owner, no reason", owner, url, post);
    await sc.agentSets(t.id, { status: "resolved" });
    await sc.call("the agent, with a message", "superadmin", url, {
      ...post,
      body: { body: "Reopening to look again" },
    });
    await sc.agentSets(t.id, { status: "resolved" });
    await sc.call("the agent, no message", "superadmin", url, post);
    await sc.call(
      "the ticket afterwards, to the agent",
      "superadmin",
      `${BASE}/tickets/${t.id}`
    );
    // new; resolved; owner reopens with a reason (tells support); resolved; owner reopens (tells support); resolved;
    // the agent's two reopenings tell nobody; resolved
    const result = await sc.result(7);
    // worked out from the route: while open, the owner and the agent get 409 (not resolved or closed), the rest 404;
    // when resolved, everybody but the owner and the agent gets 404
    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    for (const role of ROLES) {
      expect(status(`while open, as ${role}`), role).toBe(
        role === owner || role === "superadmin" ? 409 : 404
      );
      if (role !== owner && role !== "superadmin")
        expect(status(`when resolved, as ${role}`), role).toBe(404);
    }
    for (const step of [
      "the owner, with a reason",
      "the owner, no reason",
      "the agent, with a message",
      "the agent, no message",
    ])
      expect(status(step), step).toBe(200);
    await pin(E, 1, "a resolved ticket", result);
  });

  it("a closed ticket can be reopened for 14 days, not after", async () => {
    const sc = new Scenario();
    const inside = await sc.ticket("recruiter_manager");
    await sc.agentSets(inside.id, { status: "resolved" });
    const confirmed = await as(
      "recruiter_manager",
      `${BASE}/tickets/${inside.id}/confirm`,
      post
    );
    expect(confirmed.status, confirmed.text).toBe(200);
    await sc.call(
      "closed a moment ago, the owner reopens with a reason",
      "recruiter_manager",
      `${BASE}/tickets/${inside.id}/reopen`,
      {
        ...post,
        body: { body: "Sorry, it came back" },
      }
    );
    const late = await sc.ticket("recruiter_manager");
    await sc.agentSets(late.id, { status: "resolved" });
    await as("recruiter_manager", `${BASE}/tickets/${late.id}/confirm`, post);
    await serviceUpdate("support_tickets", `id=eq.${late.id}`, {
      closed_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    });
    await sc.call(
      "closed 15 days ago, the owner reopens",
      "recruiter_manager",
      `${BASE}/tickets/${late.id}/reopen`,
      post
    );
    await sc.call(
      "closed 15 days ago, the agent reopens",
      "superadmin",
      `${BASE}/tickets/${late.id}/reopen`,
      post
    );
    const result = await sc.result(5); // new, resolved, the owner's reopening | new, resolved
    expect(sc.steps.map((s) => s.status)).toEqual([200, 409, 409]);
    expect((sc.steps[1].answer as any).code).toBe("REOPEN_WINDOW_EXPIRED");
    await pin(E, 2, "a closed ticket", result);
  });

  it("an id that is not a ticket", async () => {
    const sc = new Scenario();
    await sc.call(
      "not a uuid",
      "recruiter",
      `${BASE}/tickets/abc/reopen`,
      post
    );
    await sc.call(
      "a uuid nobody has",
      "recruiter",
      `${BASE}/tickets/${randomUUID()}/reopen`,
      post
    );
    await pin(E, 3, "an id that is not a ticket", await sc.result(0));
  });

  it("no token is 401 and a bad token 403", async () => {
    const url = `${BASE}/tickets/00000000-0000-4000-8000-000000001002/reopen`;
    expect((await as("admin", url, { ...post, token: "anon" })).status).toBe(
      401
    );
    expect((await as("admin", url, { ...post, token: "bad" })).status).toBe(
      403
    );
  });
});

describe("PATCH /api/support/tickets/:id", () => {
  const E = "ticket patch";

  it("only the agent may; nobody else, the owner and every admin included", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter");
    const url = `${BASE}/tickets/${t.id}`;
    for (const role of ROLES)
      await sc.call(
        `as ${role}`,
        role,
        url,
        patch({ priority: "p1", title: `Changed by ${role}` })
      );
    await sc.call("the ticket afterwards, to the agent", "superadmin", url);
    const result = await sc.result(1); // the new ticket
    // worked out from the route: 200 for the agent alone, 404 for everybody else (and nothing changes for them)
    expect(
      Object.fromEntries(
        sc.steps.slice(0, ROLES.length).map((s) => [s.as, s.status])
      )
    ).toEqual({
      admin: 404,
      superadmin: 200,
      recruiter: 404,
      bookkeeper: 404,
      recruiter_manager: 404,
      accountant_manager: 404,
      sales: 404,
      recruiter_director: 404,
      jobseeker: 404,
    });
    expect((sc.steps[sc.steps.length - 1].answer as any).ticket.title).toBe(
      "Changed by superadmin"
    );
    await pin(E, 1, "only the agent", result);
  });

  it("the statuses a ticket may move between", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("admin");
    const url = `${BASE}/tickets/${t.id}`;
    const to = (step: string, status: string, extra: object = {}) =>
      sc.call(step, "superadmin", url, patch({ status, ...extra }));
    await to("open to closed", "closed");
    await to("open to open (nothing to change)", "open");
    await to("open to in progress", "in_progress");
    await to(
      "in progress to waiting on the client (tells the requester)",
      "waiting_on_client"
    );
    await to("waiting to resolved (tells the requester)", "resolved");
    await to("resolved to waiting", "waiting_on_client");
    await to("resolved to closed", "closed");
    await to("closed to resolved", "resolved");
    await to("closed back to in progress", "in_progress");
    await to("a status that does not exist", "paused");
    await sc.call("the ticket afterwards", "superadmin", url);
    // the new ticket, then "waiting on client" and "resolved" to the requester; closing and reopening tell nobody
    const result = await sc.result(3);
    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    // worked out from the allowed table in migration 027: from open: in progress, waiting, resolved; from in progress:
    // waiting, resolved; from waiting: in progress, resolved; from resolved: closed, in progress; from closed: in progress
    expect(status("open to closed")).toBe(409);
    expect(status("open to in progress")).toBe(200);
    expect(status("waiting to resolved (tells the requester)")).toBe(200);
    expect(status("resolved to waiting")).toBe(409);
    expect(status("resolved to closed")).toBe(200);
    expect(status("closed to resolved")).toBe(409);
    expect(status("closed back to in progress")).toBe(200);
    expect(status("a status that does not exist")).toBe(400);
    await pin(E, 2, "status moves", result);
  });

  it("priority, title, assignee and hours, each checked before anything changes", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("bookkeeper");
    const url = `${BASE}/tickets/${t.id}`;
    const edit = (step: string, body: unknown) =>
      sc.call(step, "superadmin", url, patch(body));
    await edit("nothing to change", {});
    await edit("priority p1", { priority: "p1" });
    await edit("a priority that does not exist", { priority: "p9" });
    await edit("a new title, with spaces around it", {
      title: "  A clearer title  ",
    });
    await edit("an empty title", { title: "   " });
    await edit("a title of 201 characters", { title: "t".repeat(201) });
    await edit("assigned to the agent", {
      assignedTo: "00000000-0000-4000-8000-000000000002",
    });
    await edit("assigned to nobody", { assignedTo: null });
    await edit("assigned to something that is not an id", { assignedTo: "me" });
    await edit("hours 1.5", { effortHours: 1.5 });
    await edit("hours as text", { effortHours: "2.25" });
    await edit("hours 0", { effortHours: 0 });
    await edit("hours below zero", { effortHours: -1 });
    await edit("hours over 1000", { effortHours: 1001 });
    await edit("hours that are not a number", { effortHours: "lots" });
    await edit("several at once, one of them wrong: nothing changes", {
      priority: "p2",
      title: "Half done",
      effortHours: "x",
    });
    await edit("status and hours together", {
      status: "resolved",
      effortHours: 3,
    });
    await edit("hours with the status it already has", {
      status: "resolved",
      effortHours: 4,
    });
    await sc.call("the ticket afterwards", "superadmin", url);
    const result = await sc.result(2); // the new ticket, then "resolved" to the requester
    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    for (const bad of [
      "a priority that does not exist",
      "an empty title",
      "a title of 201 characters",
      "assigned to something that is not an id",
      "hours below zero",
      "hours over 1000",
      "hours that are not a number",
      "several at once, one of them wrong: nothing changes",
    ])
      expect(status(bad), bad).toBe(400);
    const last = (sc.steps[sc.steps.length - 1].answer as any).ticket;
    // 4 hours = 240 minutes, the last value written; the failed request changed neither priority nor title
    expect([
      last.effortMinutes,
      last.priority,
      last.title,
      last.assignedTo,
    ]).toEqual([240, "p1", "A clearer title", null]);
    await pin(E, 3, "fields", result);
  });

  it("an id that is not a ticket", async () => {
    const sc = new Scenario();
    await sc.call(
      "not a uuid",
      "superadmin",
      `${BASE}/tickets/abc`,
      patch({ priority: "p1" })
    );
    await sc.call(
      "a uuid nobody has",
      "superadmin",
      `${BASE}/tickets/${randomUUID()}`,
      patch({ priority: "p1" })
    );
    await pin(E, 4, "an id that is not a ticket", await sc.result(0));
  });

  it("no token is 401 and a bad token 403", async () => {
    const url = `${BASE}/tickets/00000000-0000-4000-8000-000000001002`;
    expect(
      (await as("admin", url, { ...patch({}), token: "anon" })).status
    ).toBe(401);
    expect(
      (await as("admin", url, { ...patch({}), token: "bad" })).status
    ).toBe(403);
  });
});
