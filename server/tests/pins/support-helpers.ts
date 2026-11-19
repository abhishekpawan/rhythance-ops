// Helpers for the Support API pins (tests/pins/support-*.test.ts): who may call what, a recorder for a run of
// requests, the messages the server tried to send, and the snapshot files.
//
// Support answers 404, never 401 or 403, to a signed-in caller who may not do something (the client signs a user
// out on 401 or 403), so these pins are written per role instead of with `pinEndpoint`.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, inject } from "vitest";
import { SUPPORT_SEEDED } from "../seed/ids.mjs";
import {
  jobseekerEmails,
  server,
  staffEmails,
  stack,
  supabase,
  tokenFor,
  type Reply,
} from "../support/api";
import { normalise } from "./pin";

export const STAFF_ROLES = Object.keys(staffEmails) as Array<
  keyof typeof staffEmails
>;
/** Every account the pins try: the eight staff roles and a jobseeker (who can never use Support). */
export const ROLES = [...STAFF_ROLES, "jobseeker"] as const;
export type Role = (typeof ROLES)[number];

/** The support agent is the super admin; shared viewers (see every ticket) are admin and the recruiter roles. */
export const AGENT: Role = "superadmin";

export const SEEDED_TICKETS = 5;
export const BASE = "/api/support";

const tokenOf = (role: Role) =>
  tokenFor(role === "jobseeker" ? jobseekerEmails.sin : staffEmails[role]);

// The server limits each user to 10 new tickets, 30 messages and 30 upload links an hour (src/middleware/
// supportRateLimits.ts) and counts every request, failed ones too. The limits belong to the server process, which
// every test file shares, so a test that goes over would fail in a way that depends on what ran before. The count
// is kept in a file beside the message log (it goes with the run) and `as` stops with a clear message before the limit.
// (Rate-limit tests of the real limit call `server` directly instead.)
const MAX = { create: 8, message: 28, sign: 28 } as const;

function countRequest(key: string): number {
  const file = path.join(
    path.dirname(inject("outboundLog")),
    "support-budget.json"
  );
  const used: Record<string, number> = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {};
  used[key] = (used[key] ?? 0) + 1;
  writeFileSync(file, JSON.stringify(used));
  return used[key];
}

function limitKind(method: string, path: string) {
  if (method === "POST" && path === `${BASE}/tickets`) return "create";
  if (method === "POST" && path.endsWith("/messages")) return "message";
  if (method === "POST" && path === `${BASE}/attachments/sign`) return "sign";
  return undefined;
}

export interface Call {
  method?: string;
  body?: unknown;
  /** the server whose clock stands still (a date shows in the answer); the default server uses the real clock */
  fixedClock?: boolean;
  /** send no token ("anon") or a wrong one ("bad") */
  token?: "anon" | "bad";
}

/** One request as a role, through the real server. */
export async function as(
  role: Role,
  path: string,
  { method = "GET", body, fixedClock, token }: Call = {}
): Promise<Reply> {
  const kind = limitKind(method, path);
  if (kind && !fixedClock && !token) {
    const n = countRequest(`${role}:${kind}`);
    if (n > MAX[kind])
      throw new Error(
        `${role} would be over the hourly ${kind} limit (${n} > ${MAX[kind]}): use another role for this test`
      );
  }
  return server(path, {
    method,
    body,
    fixedClock,
    token:
      token === "anon"
        ? undefined
        : token === "bad"
          ? "not-a-token"
          : await tokenOf(role),
  });
}

// ----- the messages the server tried to send -----

const entries = () =>
  readFileSync(inject("outboundLog"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);

/** Support notifications recorded so far (their subject starts with `[Portal name] SUP-0001:`). */
export const supportMails = () =>
  entries().filter(
    (e) => e.kind === "email" && /\] SUP-\d{4}: /.test(String(e.subject))
  );

/** Waits for the n-th support message after `start`; the server sends them after it has answered. */
async function waitForMails(start: number, n: number) {
  const end = Date.now() + 8000;
  while (supportMails().length - start < n) {
    if (Date.now() > end)
      throw new Error(
        `expected ${n} support messages, got ${supportMails().length - start}`
      );
    await new Promise((r) => setTimeout(r, 50));
  }
}

// ----- a run of requests, recorded -----

interface Step {
  step: string;
  as: Role;
  request: string;
  requestBody?: unknown;
  status: number;
  answer: unknown;
}

/**
 * A scenario is a run of requests whose answers are stored together with the messages the server sent while it ran.
 * Ticket ids made at run time become `<uuid>` in the stored file; the ones from the seed stay.
 */
export class Scenario {
  steps: Step[] = [];
  private mailStart = supportMails().length;

  async call(
    step: string,
    role: Role,
    path: string,
    call: Call = {}
  ): Promise<Reply> {
    const r = await as(role, path, call);
    this.steps.push({
      step,
      as: role,
      request: `${call.method ?? "GET"} ${path}`,
      ...(call.body !== undefined ? { requestBody: call.body } : {}),
      status: r.status,
      answer: maskElapsed(r.json ?? r.text),
    });
    return r;
  }

  /** Makes a ticket as `role` and returns its id (not stored as a step: it only sets the scene). */
  async ticket(
    role: Role,
    over: Record<string, unknown> = {}
  ): Promise<{ id: string; number: number }> {
    const r = await as(role, `${BASE}/tickets`, {
      method: "POST",
      body: {
        type: "bug",
        urgency: "annoying",
        description: `Scene for a pin\nMade by ${role}`,
        idempotencyKey: randomUUID(),
        locale: "en",
        ...over,
      },
    });
    expect(r.status, r.text).toBe(200);
    return { id: r.json.ticket.id, number: r.json.ticket.ticketNumber };
  }

  /** Sets the scene as the agent: moves a ticket to a status through the real API (not stored). */
  async agentSets(id: string, body: Record<string, unknown>) {
    const r = await as(AGENT, `${BASE}/tickets/${id}`, {
      method: "PATCH",
      body,
    });
    expect(r.status, r.text).toBe(200);
  }

  /** The stored result. `mails` is how many support messages the whole run must have caused, no more, no fewer. */
  async result(mails: number) {
    await waitForMails(this.mailStart, mails);
    const sent = supportMails().slice(this.mailStart);
    expect(sent.length, JSON.stringify(sent)).toBe(mails);
    return {
      steps: this.steps,
      messagesSent: sent.map((m) => ({
        to: m.to,
        ...(m.cc.length ? { cc: m.cc } : {}),
        subject: m.subject,
      })),
    };
  }
}

// ----- the snapshot files -----

/** The run-time parts of an answer, replaced by placeholders (ids, dates, ticket numbers above the seed, tokens). */
export function settle(value: unknown): unknown {
  const first = normalise(value);
  return JSON.parse(
    JSON.stringify(first, (k, v) => {
      if (k === "token" && typeof v === "string") return "<token>";
      if (k === "ticketNumber" && typeof v === "number" && v > SEEDED_TICKETS)
        return "<number>";
      if (typeof v !== "string") return v;
      return (
        v
          // Postgres drops trailing zeros, so a run-time stamp can have one or two digits after the seconds;
          // `normalise` only knows three to six. The seeded stamps have no fraction at all.
          .replace(
            /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,2}(?:Z|[+-]\d\d:\d\d)/g,
            "<timestamp>"
          )
          .replace(/^https?:\/\/[^/\s]+/, "<host>")
          .replace(/token=[\w.-]+/g, "token=<token>")
          .replace(/SUP-(\d{4})/g, (m, n) =>
            Number(n) > SEEDED_TICKETS ? "SUP-<number>" : m
          )
      );
    })
  );
}

/**
 * The minutes a ticket has been open or in progress are counted up to "now" by the database, so they change with
 * the clock. They are checked (a whole number, not negative) and replaced when the ticket is open or in progress, and
 * for every ticket a test made (its few seconds between two events can cross a minute); the seeded tickets that are
 * waiting, resolved or closed have fixed events and keep their number.
 */
export function maskElapsed(answer: any) {
  const body = answer?.json ?? answer;
  const ticket = body?.ticket;
  if (!ticket || body.elapsedMinutes === undefined) return body;
  const mask =
    ["open", "in_progress"].includes(ticket.status) ||
    !SUPPORT_SEEDED.includes(ticket.id);
  if (!mask) return body;
  expect(Number.isInteger(body.elapsedMinutes)).toBe(true);
  expect(body.elapsedMinutes).toBeGreaterThanOrEqual(0);
  return {
    ...body,
    elapsedMinutes: "<minutes>",
    ticket: { ...ticket, elapsedMinutes: "<minutes>" },
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Stores `value` as `__snapshots__/api-support-<endpoint>/NN-<name>.json`; a change fails the test. */
export async function pin(
  endpoint: string,
  n: number,
  name: string,
  value: unknown
) {
  await expect(
    JSON.stringify(settle(value), null, 2) + "\n"
  ).toMatchFileSnapshot(
    `__snapshots__/api-support-${slug(endpoint)}/${String(n).padStart(2, "0")}-${slug(name)}.json`
  );
}

/** The same request as every role, as one stored file: `{ role: { status, answer } }`. */
export async function everyRole(
  path: string,
  call: Call = {},
  roles: readonly Role[] = ROLES
) {
  const out: Record<string, { status: number; answer: unknown }> = {};
  for (const role of roles) {
    const r = await as(role, path, call);
    out[role] = {
      status: r.status,
      answer: maskElapsed(r.json ?? r.text),
    };
  }
  return out;
}

/** Removes every ticket the tests made at run time, so the seeded five are what the read pins see. */
export async function removeRunTimeTickets() {
  const s = stack();
  const r = await supabase(
    `/rest/v1/support_tickets?id=not.in.(${SUPPORT_SEEDED.join(",")})`,
    {
      method: "DELETE",
      token: s.serviceKey,
      key: s.serviceKey,
      headers: { Prefer: "return=minimal" },
    }
  );
  expect(r.status, r.text).toBeLessThan(300);
}

/** Direct change of a ticket row as the service role (to set a date back without waiting 14 days). */
export async function serviceUpdate(
  table: string,
  filter: string,
  body: Record<string, unknown>
) {
  const s = stack();
  const r = await supabase(`/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    token: s.serviceKey,
    key: s.serviceKey,
    body,
    headers: { Prefer: "return=minimal" },
  });
  expect(r.status, r.text).toBeLessThan(300);
}

/** Uploads a small file through the signed upload link the server hands out; returns what the ticket call needs. */
export async function uploadAttachment(
  role: Role,
  file: { name: string; mime: string; content: string }
) {
  const bytes = Buffer.from(file.content, "utf8");
  const sign = await as(role, `${BASE}/attachments/sign`, {
    method: "POST",
    body: { fileName: file.name, mimeType: file.mime, sizeBytes: bytes.length },
  });
  expect(sign.status, sign.text).toBe(200);
  const put = await fetch(sign.json.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.mime },
    body: bytes,
  });
  expect(put.status, await put.text()).toBeLessThan(300);
  return {
    path: sign.json.path as string,
    fileName: file.name,
    mimeType: file.mime,
    sizeBytes: bytes.length,
  };
}
