// The real server, doing something that sends email, against the test guard: the email is recorded, not sent.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, inject } from "vitest";
import { server, staffEmails, tokenFor } from "../support/api";

const entries = () =>
  readFileSync(inject("outboundLog"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);

async function waitFor<T>(find: () => T | undefined, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > end) throw new Error("nothing recorded in time");
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("a support ticket created through the real server", () => {
  it("makes a notification email that is recorded and sent to nobody", async () => {
    const token = await tokenFor(staffEmails.recruiter);
    const r = await server("/api/support/tickets", {
      token,
      method: "POST",
      body: {
        type: "bug",
        urgency: "blocked",
        description: "Test ticket from the safety net",
        idempotencyKey: randomUUID(),
        locale: "en",
      },
    });
    expect(r.status, r.text).toBeLessThan(300);

    const mail = await waitFor(() => entries().find((e) => e.kind === "email"));
    expect(mail.to.length).toBeGreaterThan(0);
    // every address the server tried to write to is a synthetic one
    for (const e of entries().filter((e) => e.kind === "email")) {
      for (const address of [...e.to, ...e.cc, ...e.bcc])
        expect(address, JSON.stringify(e)).toMatch(/@example\.test$/);
    }
    // and nothing tried to leave the machine
    expect(
      entries().filter((e) => String(e.kind).startsWith("blocked"))
    ).toEqual([]);
  });
});

describe("the folder the test server runs from", () => {
  it("holds no .env, so nothing from server/.env (which points at stage) can reach it", () => {
    const dir = inject("serverWorkDir");
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.startsWith(".env"))).toEqual([]);
    expect(existsSync(path.join(dir, ".env"))).toBe(false);
  });
});
