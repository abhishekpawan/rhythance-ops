// Helpers for the R-3 API pins (admin pages, calendar, email templates): one request as any account, the same request
// as every account, and the snapshot files. These endpoints answer 403 (not 404) to a signed-in person who may not call
// them, and 401 / 403 to no token / a bad token, so each test states who may call what and the pins store the rest.
import { expect, inject } from "vitest";
import { readFileSync } from "node:fs";
import {
  jobseekerEmails,
  server,
  staffEmails,
  tokenFor,
  type Reply,
} from "../support/api";
import { normalise } from "./pin";

export const STAFF_ROLES = Object.keys(staffEmails) as Array<
  keyof typeof staffEmails
>;
/** Every account the pins try: the eight staff roles and a jobseeker. */
export const ROLES = [...STAFF_ROLES, "jobseeker"] as const;
export type Role = (typeof ROLES)[number];

export interface Call {
  method?: string;
  body?: unknown;
  /** the server whose clock stands still (10:00 on 17 November 2026 in Toronto) */
  fixedClock?: boolean;
  /** send no token ("anon") or a wrong one ("bad") */
  token?: "anon" | "bad";
}

const tokenOf = (role: Role) =>
  tokenFor(role === "jobseeker" ? jobseekerEmails.sin : staffEmails[role]);

/** One request as `role` through the real server. */
export async function as(
  role: Role,
  path: string,
  { method = "GET", body, fixedClock, token }: Call = {}
): Promise<Reply> {
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

/** The run-time parts of an answer (ids and timestamps the database made) replaced by placeholders. */
export function settle(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(normalise(value), (_k, v) =>
      typeof v === "string"
        ? // Postgres drops trailing zeros, so a stamp can have one or two digits after the seconds
          v.replace(
            /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,2}(?:Z|[+-]\d\d:\d\d)/g,
            "<timestamp>"
          )
        : v
    )
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Stores `value` as `__snapshots__/<dir>/NN-<name>.json`; a change fails the test. */
export async function pin(
  dir: string,
  n: number,
  name: string,
  value: unknown
) {
  await expect(
    JSON.stringify(settle(value), null, 2) + "\n"
  ).toMatchFileSnapshot(
    `__snapshots__/${dir}/${String(n).padStart(2, "0")}-${slug(name)}.json`
  );
}

/** The same request as every role in `roles`: `{ role: { status, answer } }`. */
export async function everyRole(
  path: string,
  call: Call = {},
  roles: readonly Role[] = ROLES
) {
  const out: Record<string, { status: number; answer: unknown }> = {};
  for (const role of roles) {
    const r = await as(role, path, call);
    out[role] = { status: r.status, answer: r.json ?? r.text };
  }
  return out;
}

/**
 * The same read as every account, stored compactly: `allowed` must each give the same status and answer (stored once);
 * the others' answers are stored per role. Fails when an allowed role differs, or when a role not listed gets in.
 */
export async function matrix(
  path: string,
  allowed: readonly Role[],
  call: Call = {}
) {
  const all = await everyRole(path, call);
  const first = all[allowed[0]];
  for (const role of allowed) {
    expect(all[role], `${role} on ${path}`).toEqual(first);
  }
  const refused: Record<string, { status: number; answer: unknown }> = {};
  for (const role of ROLES.filter((r) => !allowed.includes(r))) {
    refused[role] = all[role];
  }
  return { allowed: [...allowed], answer: first, refused };
}

/** No token is 401 and a bad token 403, whatever the endpoint. */
export async function noTokenAnswers(path: string, call: Call = {}) {
  const anon = await as("admin", path, { ...call, token: "anon" });
  const bad = await as("admin", path, { ...call, token: "bad" });
  return {
    noToken: { status: anon.status, answer: anon.json ?? anon.text },
    badToken: { status: bad.status, answer: bad.json ?? bad.text },
  };
}

/** The lines the recorders of the test server have written (messages it tried to send or sockets it refused). */
export const outboundLines = () =>
  readFileSync(inject("outboundLog"), "utf8").split("\n").filter(Boolean);
