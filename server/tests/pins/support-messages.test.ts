// API pins for POST /api/support/tickets/:id/messages (server/src/routes/support/ticketActions.ts): who may write on a
// ticket, what an internal note is, the status a reply sets, files on a message, and what the server refuses.
//
// Every test makes its own tickets (the seeded five are read-only for the pins), as accounts that the other
// support pin files do not use up (the server's hourly allowances are shared: see `as` in support-helpers.ts).
// `result(n)`: n is every support message the whole run made the server send, the ones that set the scene included
// (a new ticket tells the support address; a reply from the owner tells it too; an agent's public reply and a
// ticket becoming "waiting on client" or "resolved" tell the requester; an internal note tells nobody).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stack, supabase } from "../support/api";
import {
  as,
  BASE,
  pin,
  ROLES,
  Scenario,
  uploadAttachment,
} from "./support-helpers";

const E = "message create";
const reply = (body: unknown, extra: Record<string, unknown> = {}) => ({
  method: "POST",
  body: { body, ...extra },
});

describe("POST /api/support/tickets/:id/messages", () => {
  it("every account tries to write on one ticket", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("accountant_manager");
    for (const role of ROLES)
      await sc.call(
        `as ${role}`,
        role,
        `${BASE}/tickets/${t.id}/messages`,
        reply(`A reply from ${role}`)
      );
    const result = await sc.result(3); // the new ticket, the owner's reply, the agent's reply
    // worked out from the route: the owner and the agent may; everybody else, an admin and a jobseeker included, gets 404
    expect(Object.fromEntries(sc.steps.map((s) => [s.as, s.status]))).toEqual({
      admin: 404,
      superadmin: 200,
      recruiter: 404,
      bookkeeper: 404,
      recruiter_manager: 404,
      accountant_manager: 200,
      sales: 404,
      recruiter_director: 404,
      jobseeker: 404,
    });
    await sc.call(
      "how it reads afterwards, to the agent",
      "superadmin",
      `${BASE}/tickets/${t.id}`
    );
    await pin(E, 1, "every account", result);
  });

  it("what the server refuses", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter_manager");
    const path = `${BASE}/tickets/${t.id}/messages`;
    const post = (step: string, p: string, call: object) =>
      sc.call(step, "recruiter_manager", p, call);
    await post("no body at all", path, { method: "POST" });
    await post("an empty text", path, reply(""));
    await post("a text of spaces", path, reply("  \n "));
    await post("a text that is not text", path, reply(42));
    await post("a text of 10001 characters", path, reply("x".repeat(10001)));
    await post("a text of exactly 10000", path, reply("y".repeat(10000)));
    await post(
      "six files",
      path,
      reply("with files", {
        attachments: Array.from({ length: 6 }, () => ({})),
      })
    );
    await post(
      "a file under another user's folder",
      path,
      reply("with a file", {
        attachments: [
          {
            path: `pending/${randomUUID()}/x.txt`,
            fileName: "x.txt",
            mimeType: "text/plain",
            sizeBytes: 3,
          },
        ],
      })
    );
    await post(
      "an id that is not a uuid",
      `${BASE}/tickets/abc/messages`,
      reply("hello")
    );
    await post(
      "a uuid that is no ticket",
      `${BASE}/tickets/00000000-0000-4000-8000-00000000ffff/messages`,
      reply("hello")
    );
    const result = await sc.result(2); // the new ticket and the one 10000-character reply
    expect(sc.steps.map((s) => s.status)).toEqual([
      400, 400, 400, 400, 400, 200, 400, 400, 404, 404,
    ]);
    await pin(E, 2, "what the server refuses", result);
  });

  it("an internal note is the agent's alone; a requester cannot make one", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter_manager");
    const path = `${BASE}/tickets/${t.id}/messages`;
    const ticket = `${BASE}/tickets/${t.id}`;
    await sc.call(
      "the agent writes an internal note",
      "superadmin",
      path,
      reply("Internal: check the logs", { isInternal: true })
    );
    await sc.call("the owner reads the ticket", "recruiter_manager", ticket);
    await sc.call("a shared viewer reads the ticket", "recruiter", ticket);
    await sc.call("the agent reads the ticket", "superadmin", ticket);
    await sc.call(
      "the owner asks for an internal note",
      "recruiter_manager",
      path,
      reply("Please look at this", { isInternal: true })
    );
    await sc.call(
      "the agent writes a public reply",
      "superadmin",
      path,
      reply("We are on it", { isInternal: false })
    );
    await sc.call("the agent reads the ticket again", "superadmin", ticket);
    const result = await sc.result(3); // the new ticket, the owner's message (public after all), the agent's public reply; the note sent nothing
    const note = sc.steps[0].answer as any;
    expect(note.message.isInternal).toBe(true);
    // the note never reaches the owner or the shared viewer
    for (const i of [1, 2]) {
      const msgs = (sc.steps[i].answer as any).messages as any[];
      expect(msgs.map((m) => m.body)).toEqual([
        expect.stringContaining("Scene for a pin"),
      ]);
    }
    // what the owner asked to be internal was stored as public
    const after = (sc.steps[6].answer as any).messages as any[];
    expect(after.map((m) => [m.authorKind, m.isInternal])).toEqual([
      ["requester", false],
      ["agent", true],
      ["requester", false],
      ["agent", false],
    ]);
    await pin(E, 3, "internal notes", result);
  });

  it("a reply from the owner sets a waiting ticket back in progress; the agent's reply changes no status", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("recruiter");
    const path = `${BASE}/tickets/${t.id}/messages`;
    const ticket = `${BASE}/tickets/${t.id}`;
    await sc.agentSets(t.id, { status: "waiting_on_client" });
    await sc.call(
      "the agent answers a waiting ticket",
      "superadmin",
      path,
      reply("Which page was it?")
    );
    await sc.call("the ticket", "superadmin", ticket);
    await sc.call(
      "the owner answers",
      "recruiter",
      path,
      reply("The weekly timesheet")
    );
    await sc.call("the ticket again", "superadmin", ticket);
    const result = await sc.result(4); // new, waiting, the agent's reply, the owner's reply
    expect((sc.steps[1].answer as any).ticket.status).toBe("waiting_on_client");
    expect((sc.steps[3].answer as any).ticket.status).toBe("in_progress");
    await pin(E, 4, "a waiting ticket", result);
  });

  it("a reply on a resolved ticket and on a closed one reopens it", async () => {
    const sc = new Scenario();
    const resolved = await sc.ticket("recruiter");
    await sc.agentSets(resolved.id, { status: "resolved" });
    await sc.call(
      "the owner replies to a resolved ticket",
      "recruiter",
      `${BASE}/tickets/${resolved.id}/messages`,
      reply("It is still wrong")
    );
    await sc.call("the ticket", "superadmin", `${BASE}/tickets/${resolved.id}`);
    const closed = await sc.ticket("recruiter");
    await sc.agentSets(closed.id, { status: "resolved" });
    const confirm = await as(
      "recruiter",
      `${BASE}/tickets/${closed.id}/confirm`,
      { method: "POST" }
    );
    expect(confirm.status, confirm.text).toBe(200);
    await sc.call(
      "the owner replies to a closed ticket",
      "recruiter",
      `${BASE}/tickets/${closed.id}/messages`,
      reply("Sorry, it came back")
    );
    await sc.call(
      "the closed ticket now",
      "superadmin",
      `${BASE}/tickets/${closed.id}`
    );
    // new, resolved, reply | new, resolved, (confirm sends nothing), reply
    const result = await sc.result(6);
    expect((sc.steps[1].answer as any).ticket.status).toBe("in_progress");
    expect((sc.steps[3].answer as any).ticket.status).toBe("in_progress");
    await pin(E, 5, "a resolved and a closed ticket", result);
  });

  it("files on a message", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("accountant_manager");
    const file = await uploadAttachment("accountant_manager", {
      name: "log.txt",
      mime: "text/plain",
      content: "an error\n",
    });
    const path = `${BASE}/tickets/${t.id}/messages`;
    await sc.call(
      "a message with a file",
      "accountant_manager",
      path,
      reply("The log is attached", { attachments: [file] })
    );
    await sc.call(
      "the same file again, as another message",
      "accountant_manager",
      path,
      reply("Again", { attachments: [file] })
    );
    await sc.call(
      "the agent reads the ticket",
      "superadmin",
      `${BASE}/tickets/${t.id}`
    );
    await sc.call(
      "the owner reads the ticket",
      "accountant_manager",
      `${BASE}/tickets/${t.id}`
    );
    const result = await sc.result(3); // new, two messages
    const agent = (sc.steps[2].answer as any).attachments as any[];
    expect(agent).toHaveLength(1); // stored once: a file belongs to the first message that names it
    expect(agent[0]).toHaveProperty("messageId");
    expect((sc.steps[3].answer as any).attachments[0]).not.toHaveProperty(
      "messageId"
    );
    await pin(E, 6, "files on a message", result);
  });

  it("a ticket holds at most 200 messages", async () => {
    const sc = new Scenario();
    const t = await sc.ticket("accountant_manager");
    const s = stack();
    // the ticket has its first message; 199 more (made directly, as the service role) make 200
    const rows = Array.from({ length: 199 }, (_, i) => ({
      ticket_id: t.id,
      author_name: "Test",
      author_kind: "agent",
      body: `filler ${i}`,
    }));
    const insert = await supabase("/rest/v1/support_ticket_messages", {
      method: "POST",
      token: s.serviceKey,
      key: s.serviceKey,
      body: rows,
      headers: { Prefer: "return=minimal" },
    });
    expect(insert.status, insert.text).toBeLessThan(300);
    await sc.call(
      "the 201st message",
      "accountant_manager",
      `${BASE}/tickets/${t.id}/messages`,
      reply("one too many")
    );
    await sc.call(
      "the agent's too",
      "superadmin",
      `${BASE}/tickets/${t.id}/messages`,
      reply("also too many")
    );
    const result = await sc.result(1);
    expect(sc.steps.map((x) => x.status)).toEqual([409, 409]);
    await pin(E, 7, "the 200 message limit", result);
  });

  it("no token is 401 and a bad token 403", async () => {
    const path = `${BASE}/tickets/00000000-0000-4000-8000-000000001005/messages`;
    expect(
      (await as("admin", path, { ...reply("hi"), token: "anon" })).status
    ).toBe(401);
    expect(
      (await as("admin", path, { ...reply("hi"), token: "bad" })).status
    ).toBe(403);
  });
});
