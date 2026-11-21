// More API pins for PATCH /api/support/tickets/:id (server/src/routes/support/ticketPatch.ts), written so the route's
// rules can be moved into a table without a single answer changing (R-2b, step 6). support-actions.test.ts pins the
// route's main paths; this file closes what it left open:
//   * every move from every status to every status, as the agent, with the answer of each (25 cells, and a closed
//     ticket whose 14 days are over);
//   * every other account (eight of them) against every from-status and every to-status: always 404, nothing moves;
//   * every field with the values at its edges, what "no value" means, which message comes first when several fields
//     are wrong, and what is ignored.
// The ticket is made, and put in its starting status, directly as the service role (the dates the database function
// leaves behind are what a person would see), then the real route is asked. Nothing goes through the create route, so
// the hourly allowance of new tickets that every support pin file shares (support-helpers.ts) is not touched.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STAFF } from "../seed/ids.mjs";
import { stack, supabase } from "../support/api";
import {
  as,
  AGENT,
  BASE,
  pin,
  ROLES,
  Scenario,
  serviceUpdate,
} from "./support-helpers";

const patch = (body: unknown) => ({ method: "PATCH", body });
const STATUSES = [
  "open",
  "in_progress",
  "waiting_on_client",
  "resolved",
  "closed",
] as const;
type Status = (typeof STATUSES)[number];
const E = "ticket patch";

/** A new open ticket of the seeded sales account, as the service role (the same row the create route stores). */
async function makeTicket(): Promise<{ id: string }> {
  const s = stack();
  const r = await supabase("/rest/v1/support_tickets", {
    method: "POST",
    token: s.serviceKey,
    key: s.serviceKey,
    headers: { Prefer: "return=representation" },
    body: {
      idempotency_key: randomUUID(),
      type: "bug",
      title: "Scene for a pin",
      urgency: "annoying",
      priority: "p2",
      status: "open",
      requester_id: STAFF.sales.id,
      requester_name: "Test Sales",
      requester_email: STAFF.sales.email,
      requester_roles: ["sales"],
      locale: "en",
    },
  });
  expect(r.status, r.text).toBeLessThan(300);
  return { id: r.json[0].id as string };
}

/** What the database function leaves on a ticket that reached `status`: the dates of resolving and closing. */
async function setStatus(
  id: string,
  status: Status,
  closedDaysAgo = 0
): Promise<void> {
  const now = Date.now();
  const stamp = (daysAgo: number) =>
    new Date(now - daysAgo * 24 * 3600 * 1000).toISOString();
  await serviceUpdate("support_tickets", `id=eq.${id}`, {
    status,
    resolved_at:
      status === "resolved" || status === "closed"
        ? stamp(closedDaysAgo)
        : null,
    closed_at: status === "closed" ? stamp(closedDaysAgo) : null,
    confirmed_by: status === "closed" ? "client" : null,
  });
}

describe("PATCH /api/support/tickets/:id, every status move", () => {
  it("the agent, from each status to each status", async () => {
    const sc = new Scenario();
    const t = await makeTicket();
    const url = `${BASE}/tickets/${t.id}`;
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        await setStatus(t.id, from);
        await sc.call(`${from} to ${to}`, AGENT, url, patch({ status: to }));
      }
    }
    await setStatus(t.id, "closed", 20);
    await sc.call(
      "closed 20 days ago to in progress (the window is 14 days)",
      AGENT,
      url,
      patch({ status: "in_progress" })
    );
    await setStatus(t.id, "closed", 13);
    await sc.call(
      "closed 13 days ago to in progress",
      AGENT,
      url,
      patch({ status: "in_progress" })
    );
    // the requester is told when a ticket becomes "waiting on client" (from open and from in progress) or
    // "resolved" (from open, in progress and waiting)
    const result = await sc.result(2 + 3);

    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    // worked out from the allowed table in migration 027, not from the answers
    const allowed: Record<Status, Status[]> = {
      open: ["in_progress", "waiting_on_client", "resolved"],
      in_progress: ["waiting_on_client", "resolved"],
      waiting_on_client: ["in_progress", "resolved"],
      resolved: ["closed", "in_progress"],
      closed: ["in_progress"],
    };
    for (const from of STATUSES)
      for (const to of STATUSES) {
        const expected =
          from === to ? 200 : allowed[from].includes(to) ? 200 : 409;
        expect(status(`${from} to ${to}`), `${from} to ${to}`).toBe(expected);
      }
    expect(
      status("closed 20 days ago to in progress (the window is 14 days)")
    ).toBe(409);
    expect(status("closed 13 days ago to in progress")).toBe(200);
    await pin(E, 5, "every status move", result);
  });

  it("everybody else, from each status to each status, is told there is no such ticket and nothing moves", async () => {
    const sc = new Scenario();
    const t = await makeTicket();
    const url = `${BASE}/tickets/${t.id}`;
    const others = ROLES.filter((r) => r !== AGENT);
    expect(others).toHaveLength(8);
    for (const from of STATUSES) {
      await setStatus(t.id, from);
      for (const to of STATUSES)
        for (const role of others) {
          const r = await as(role, url, patch({ status: to, priority: "p1" }));
          expect(r.status, `${role}: ${from} to ${to}`).toBe(404);
        }
      const after = await as(AGENT, url);
      expect(after.status).toBe(200);
      expect(after.json.ticket.status, `still ${from}`).toBe(from);
      expect(after.json.ticket.priority, "priority untouched").toBe("p2");
    }
  });
});

describe("PATCH /api/support/tickets/:id, the fields", () => {
  it("the values at the edges, no value, which complaint comes first, and what is ignored", async () => {
    const sc = new Scenario();
    const t = await makeTicket();
    const url = `${BASE}/tickets/${t.id}`;
    const edit = (step: string, body: unknown) =>
      sc.call(step, AGENT, url, patch(body));

    await edit("priority p2", { priority: "p2" });
    await edit("priority p3", { priority: "p3" });
    await edit("priority null changes nothing", { priority: null });
    await edit("priority in capitals", { priority: "P1" });
    await edit("priority as a number", { priority: 1 });
    await edit("title null changes nothing", { title: null });
    await edit("title of exactly 200 characters", { title: "a".repeat(200) });
    await edit("title of one character", { title: "x" });
    await edit("title as a number", { title: 5 });
    await edit("title with a line break and tabs", {
      title: "\tTwo\nlines\t",
    });
    await edit("assigned to the agent", {
      assignedTo: "00000000-0000-4000-8000-000000000002",
    });
    await edit("assigned to a valid id nobody has", {
      assignedTo: "00000000-0000-4000-8000-0000000000ff",
    });
    await edit("assigned to nobody", { assignedTo: null });
    await edit("assigned to an empty text", { assignedTo: "" });
    await edit("hours 1000", { effortHours: 1000 });
    await edit("hours 0.0083 round to 0 minutes", { effortHours: 0.0083 });
    await edit("hours 0.01 round to 1 minute", { effortHours: 0.01 });
    await edit("hours 2.5 as text", { effortHours: "2.5" });
    await edit("hours null changes nothing", { effortHours: null });
    await edit("hours an empty text count as 0", { effortHours: "" });
    await edit("hours false count as 0", { effortHours: false });
    await edit("hours not a number at all", { effortHours: {} });
    await edit("hours infinite", { effortHours: "Infinity" });
    await edit("status null changes nothing", { status: null });
    await edit("status in capitals", { status: "OPEN" });
    await edit("a status and a priority that are both wrong", {
      status: "paused",
      priority: "p9",
    });
    await edit("a priority and a title that are both wrong", {
      priority: "p9",
      title: "",
    });
    await edit("a title and an assignee that are both wrong", {
      title: "",
      assignedTo: "me",
    });
    await edit("an assignee and hours that are both wrong", {
      assignedTo: "me",
      effortHours: -1,
    });
    await edit("something nobody reads", { colour: "red", id: "x" });
    await edit("every field at once", {
      status: "in_progress",
      priority: "p1",
      title: "All five",
      assignedTo: "00000000-0000-4000-8000-000000000002",
      effortHours: 1.25,
    });
    await edit("the same again (the status is the one it has)", {
      status: "in_progress",
      priority: "p1",
      title: "All five",
      assignedTo: "00000000-0000-4000-8000-000000000002",
      effortHours: 1.25,
    });
    await sc.call("the ticket afterwards", AGENT, url);
    const result = await sc.result(0); // "in progress" tells nobody

    const status = (step: string) =>
      sc.steps.find((s) => s.step === step)!.status;
    for (const bad of [
      "priority in capitals",
      "priority as a number",
      "title as a number",
      "assigned to an empty text",
      "hours not a number at all",
      "hours infinite",
      "status in capitals",
      "a status and a priority that are both wrong",
      "a priority and a title that are both wrong",
      "a title and an assignee that are both wrong",
      "an assignee and hours that are both wrong",
    ])
      expect(status(bad), bad).toBe(400);
    const last = (sc.steps[sc.steps.length - 1].answer as any).ticket;
    expect([
      last.status,
      last.priority,
      last.title,
      last.assignedTo,
      last.effortMinutes,
    ]).toEqual([
      "in_progress",
      "p1",
      "All five",
      "00000000-0000-4000-8000-000000000002",
      75,
    ]);
    await pin(E, 6, "more fields", result);
  });
});
