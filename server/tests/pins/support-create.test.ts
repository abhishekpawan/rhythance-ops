// API pins for ticket creation and the upload link: POST /api/support/tickets and POST /api/support/attachments/sign
// of server/src/routes/support/. Every account tries it (a jobseeker may not), then the refusals, the replay rule and the
// attachments rules. The messages the server tries to send are recorded, never delivered: each stored run says
// how many went out and to whom.
//
// The server allows ten new tickets per user per hour and counts failed requests too (`as` in support-helpers.ts
// keeps each role under it); the last test uses up the sales account's allowance on purpose.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  as,
  BASE,
  everyRole,
  pin,
  Scenario,
  uploadAttachment,
  type Role,
} from "./support-helpers";
import { server, staffEmails, tokenFor } from "../support/api";

const valid = () => ({
  type: "bug",
  urgency: "annoying",
  description: "The invoice list is empty\nI opened it and nothing is shown.",
  idempotencyKey: randomUUID(),
  locale: "en",
});

describe("POST /api/support/tickets", () => {
  const E = "ticket create";

  it("every account tries it", async () => {
    const sc = new Scenario();
    for (const role of [
      "admin",
      "superadmin",
      "recruiter",
      "bookkeeper",
      "recruiter_manager",
      "accountant_manager",
      "sales",
      "recruiter_director",
      "jobseeker",
    ] as const)
      await sc.call(`as ${role}`, role, `${BASE}/tickets`, {
        method: "POST",
        body: valid(),
      });
    const result = await sc.result(8); // eight staff accounts: one message each, to the support address
    // worked out from the route: every non-jobseeker may; the jobseeker gets 404 and nothing is stored
    expect(sc.steps.map((s) => s.status)).toEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 404,
    ]);
    // the agent's view of the new ticket carries more fields than anybody else's
    expect(Object.keys((sc.steps[1].answer as any).ticket)).toContain(
      "requesterEmail"
    );
    expect(Object.keys((sc.steps[0].answer as any).ticket)).not.toContain(
      "requesterEmail"
    );
    await pin(E, 1, "every account tries it", result);
  });

  it("what the server refuses", async () => {
    const sc = new Scenario();
    const send = (step: string, body: unknown, role: Role = "bookkeeper") =>
      sc.call(step, role, `${BASE}/tickets`, { method: "POST", body });
    await send("no body at all", undefined);
    await send("no type", { ...valid(), type: undefined });
    await send("a type that does not exist", { ...valid(), type: "complaint" });
    await send("no urgency", { ...valid(), urgency: undefined });
    await send("an urgency that does not exist", {
      ...valid(),
      urgency: "asap",
    });
    await send(
      "no description",
      { ...valid(), description: undefined },
      "accountant_manager"
    );
    await send(
      "a description of spaces",
      { ...valid(), description: "   \n  " },
      "accountant_manager"
    );
    await send(
      "a description of 10001 characters",
      { ...valid(), description: "x".repeat(10001) },
      "accountant_manager"
    );
    await send(
      "no idempotency key",
      { ...valid(), idempotencyKey: undefined },
      "accountant_manager"
    );
    await pin(E, 2, "what the server refuses", await sc.result(0));
    expect(sc.steps.map((s) => s.status)).toEqual([
      400, 400, 400, 400, 400, 400, 400, 400, 400,
    ]);
  });

  it("the title is the first line cut at 80, the context is cleaned, the locale cut at 10", async () => {
    const sc = new Scenario();
    const first = "T".repeat(95);
    const made = await sc.call(
      "a long first line, a messy context",
      "recruiter_manager",
      `${BASE}/tickets`,
      {
        method: "POST",
        body: {
          ...valid(),
          description: `  \n${first}\nsecond line  `,
          locale: "fr-CA-and-a-lot-more",
          context: {
            route: "/invoices?token=secret#top",
            fromPage: "/reports?x=1",
            language: "  fr  ",
            browser: "B".repeat(150),
            consoleErrors: [1, 2, 3, 4, 5, 6, { a: 1 }],
            failedRequests: [
              {
                method: "POST",
                path: "/api/x?y=1",
                status: "500",
                time: "now",
              },
            ],
            userId: "someone-else",
            roles: ["admin"],
            deployment: "elsewhere",
            unknownKey: "dropped",
          },
        },
      }
    );
    expect(made.status, made.text).toBe(200);
    await sc.call(
      "what the agent sees stored",
      "superadmin",
      `${BASE}/tickets/${made.json.ticket.id}`
    );
    const result = await sc.result(1);
    // worked out from the route: the description is trimmed, its first line is the title, cut at 80 characters
    expect(made.json.ticket.title).toBe(first.slice(0, 80));
    await pin(E, 3, "title and context", result);
  });

  it("the type decides nothing, the urgency decides the priority", async () => {
    const sc = new Scenario();
    const body = (type: string, urgency: string) => ({
      ...valid(),
      type,
      urgency,
    });
    const a = await sc.call(
      "question, blocked",
      "recruiter_director",
      `${BASE}/tickets`,
      { method: "POST", body: body("question", "blocked") }
    );
    const b = await sc.call(
      "change, annoying",
      "recruiter_director",
      `${BASE}/tickets`,
      { method: "POST", body: body("change", "annoying") }
    );
    const c = await sc.call(
      "feature, not urgent",
      "recruiter_director",
      `${BASE}/tickets`,
      { method: "POST", body: body("feature", "not_urgent") }
    );
    expect([a, b, c].map((r) => r.json.ticket.priority)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
    await pin(E, 4, "type and urgency", await sc.result(3));
  });

  it("the same key again returns the same ticket and sends nothing; another user's key is refused", async () => {
    const sc = new Scenario();
    const body = valid();
    const first = await sc.call("first time", "admin", `${BASE}/tickets`, {
      method: "POST",
      body,
    });
    const again = await sc.call(
      "same user, same key",
      "admin",
      `${BASE}/tickets`,
      {
        method: "POST",
        body: { ...body, description: "a different text is ignored" },
      }
    );
    await sc.call("another user, same key", "recruiter", `${BASE}/tickets`, {
      method: "POST",
      body,
    });
    expect(again.json.ticket.id).toBe(first.json.ticket.id);
    expect(again.json.ticket.title).toBe(first.json.ticket.title);
    await pin(E, 5, "the same key again", await sc.result(1)); // one message: the first time only
  });

  it("files on a ticket: checked before anything is stored", async () => {
    const sc = new Scenario();
    const file = (content: string) => ({
      name: "error.txt",
      mime: "text/plain",
      content,
    });
    const adminFile = await uploadAttachment("admin", file("line one\n"));
    const directorFile = await uploadAttachment(
      "recruiter_director",
      file("line two\n")
    );
    const send = (step: string, role: Role, attachments: unknown) =>
      sc.call(step, role, `${BASE}/tickets`, {
        method: "POST",
        body: { ...valid(), attachments },
      });
    await send("a file that was uploaded", "admin", [adminFile]);
    await send(
      "six files",
      "admin",
      Array.from({ length: 6 }, () => adminFile)
    );
    await send("a path under another user", "admin", [
      {
        ...adminFile,
        path: adminFile.path.replace(/^pending\/[^/]+/, "pending/someone-else"),
      },
    ]);
    await send("a file that is not in storage", "admin", [
      {
        ...adminFile,
        path: `pending/${adminFile.path.split("/")[1]}/${randomUUID()}-gone.txt`,
      },
    ]);
    await send("a size that is not the stored size", "recruiter_director", [
      { ...directorFile, sizeBytes: directorFile.sizeBytes + 1 },
    ]);
    await send("a name and type that do not match", "recruiter_director", [
      { ...directorFile, fileName: "error.exe" },
    ]);
    await send("a file that is too big", "recruiter_director", [
      { ...directorFile, sizeBytes: 10485761 },
    ]);
    await send("a file without its details", "recruiter_director", [
      { path: directorFile.path },
    ]);
    const result = await sc.result(1); // only the first, accepted ticket sends a message
    expect(sc.steps.map((s) => s.status)).toEqual([
      200, 400, 400, 400, 400, 400, 400, 400,
    ]);
    await pin(E, 6, "files on a ticket", result);
  });

  it("nobody is signed out for being refused: no token 401, a bad token 403", async () => {
    const anon = await as("admin", `${BASE}/tickets`, {
      method: "POST",
      body: valid(),
      token: "anon",
    });
    expect(anon.status).toBe(401);
    const bad = await as("admin", `${BASE}/tickets`, {
      method: "POST",
      body: valid(),
      token: "bad",
    });
    expect(bad.status).toBe(403);
  });

  it("the eleventh ticket request of an hour is refused (sales has used one so far)", async () => {
    // worked out from src/middleware/supportRateLimits.ts: 10 per user per hour, every request counted (the one
    // sales made in "every account tries it" included). Sales is used for nothing else; the helper is bypassed on purpose.
    const token = await tokenFor(staffEmails.sales);
    const answers: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = await server(`${BASE}/tickets`, {
        method: "POST",
        token,
        body: {},
      }); // a refusal, no ticket
      answers.push(r.status);
    }
    const refused = await server(`${BASE}/tickets`, {
      method: "POST",
      token,
      body: valid(),
    });
    expect(refused.status).toBe(429);
    expect(refused.json).toEqual({
      success: false,
      error: "Too many tickets created, please try again later.",
    });
    // one more for somebody else is not affected
    const other = await as("bookkeeper", `${BASE}/tickets`, {
      method: "POST",
      body: valid(),
    });
    expect(other.status).toBe(200);
    // ten requests so far (the matrix made one, these nine are refusals for lack of a type): all were counted
    expect(answers.every((s) => s === 400)).toBe(true);
  });
});

describe("POST /api/support/attachments/sign", () => {
  const E = "attachment sign";
  const png = {
    fileName: "screen.png",
    mimeType: "image/png",
    sizeBytes: 1200,
  };

  it("every account asks for an upload link", async () => {
    const all = await everyRole(`${BASE}/attachments/sign`, {
      method: "POST",
      body: png,
    });
    await pin(E, 1, "every account", all);
    // worked out from the route: everyone but a jobseeker
    for (const [role, a] of Object.entries(all))
      expect(a.status, role).toBe(role === "jobseeker" ? 404 : 200);
  });

  it("what the server refuses and how it names the file", async () => {
    const sc = new Scenario();
    const ask = (step: string, body: unknown) =>
      sc.call(step, "admin", `${BASE}/attachments/sign`, {
        method: "POST",
        body,
      });
    await ask("no body", undefined);
    await ask("no name", { ...png, fileName: undefined });
    await ask("no type", { ...png, mimeType: undefined });
    await ask("a type that does not match the extension", {
      ...png,
      fileName: "screen.jpg",
    });
    await ask("a type that is not allowed", {
      fileName: "run.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 5,
    });
    await ask("a name with no extension", { ...png, fileName: "screen" });
    await ask("size zero", { ...png, sizeBytes: 0 });
    await ask("size over 10 MB", { ...png, sizeBytes: 10485761 });
    await ask("size 10 MB exactly", { ...png, sizeBytes: 10485760 });
    await ask("size not a number", { ...png, sizeBytes: "big" });
    await ask("size as text that is a number", { ...png, sizeBytes: "1200" });
    await ask("a name with a path and odd characters", {
      ...png,
      fileName: "..\\..\\my screen (1).PNG",
    });
    await ask("a very long name", {
      ...png,
      fileName: `${"n".repeat(150)}.png`,
    });
    await ask("upper case type", { ...png, mimeType: "IMAGE/PNG" });
    const result = await sc.result(0);
    expect(sc.steps.map((s) => s.status)).toEqual([
      400, 400, 400, 400, 400, 400, 400, 400, 200, 400, 200, 200, 200, 200,
    ]);
    await pin(E, 2, "what the server refuses", result);
  });

  it("no token is 401 and a bad token 403", async () => {
    expect(
      (
        await as("admin", `${BASE}/attachments/sign`, {
          method: "POST",
          body: png,
          token: "anon",
        })
      ).status
    ).toBe(401);
    expect(
      (
        await as("admin", `${BASE}/attachments/sign`, {
          method: "POST",
          body: png,
          token: "bad",
        })
      ).status
    ).toBe(403);
  });
});
