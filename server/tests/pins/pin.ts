// API pins: the real server's answer to a request, stored as a snapshot file on the code as it is today.
// Same request, same answer. A snapshot that changes is a change in behaviour: look at why before updating it.
//
// `pinEndpoint` registers, for one endpoint:
//   * one snapshot per case (status and JSON body, as the first role in `roles` that may call it),
//   * the same answer from every other role that may call it (compared to the first one),
//   * the refusal of a role that may not (a jobseeker), of no token and of a bad token.
import { describe, expect, it } from "vitest";
import {
  jobseekerEmails,
  server,
  staffEmails,
  STAFF,
  tokenFor,
} from "../support/api";

export const staffRoles = Object.keys(STAFF) as Array<
  Extract<keyof typeof STAFF, string>
>;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const SEED_UUID = /^00000000-0000-4000-8000-\d{12}$/;
// A timestamp the database or the server made at run time (milliseconds or microseconds, any zone). The seed's own
// timestamps have a fixed value and stay in the snapshot as they are.
const ISO_STAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,6}(?:Z|[+-]\d\d:\d\d)/g;
const SEED_STAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000(?:Z|\+00:00)$/;

/** Ids and timestamps that were made at run time become placeholders; everything the seed fixed stays. */
export function normalise(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v !== "string") return v;
      return v
        .replace(UUID, (m) => (SEED_UUID.test(m) ? m : "<uuid>"))
        .replace(ISO_STAMP, (m) => (SEED_STAMP.test(m) ? m : "<timestamp>"));
    })
  );
}

/**
 * Rows the endpoint sorts only by `key` come back in no fixed order among rows with the same key (the database may
 * answer them in any order, and did: the same data gave two orders on two runs). The pin keeps the order of the key
 * groups exactly and sorts inside each group, so a change of the real sort still fails but a coin toss does not.
 * Envelope rows also carry a running number (`sequence_number`, `sr_no`) given in that arbitrary order: the pin checks
 * the numbers are 1..n with a matching `sr_no`, and stores the row without them.
 */
export function settleTies(body: unknown, key: string): unknown {
  if (!Array.isArray(body)) return body;
  const rows = body as Array<Record<string, unknown>>;
  const bare = rows.map((row, i) => {
    if (!("sequence_number" in row)) return row;
    const { sequence_number, sr_no, ...rest } = row;
    if (
      sequence_number !== i + 1 ||
      typeof sr_no !== "string" ||
      !sr_no.endsWith(`-${String(i + 1).padStart(3, "0")}`)
    ) {
      throw new Error(
        `row ${i}: running number ${String(sequence_number)} / ${String(sr_no)} is not ${i + 1}`
      );
    }
    return { sr_no_prefix: sr_no.slice(0, -4), ...rest };
  });
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < bare.length;) {
    let j = i;
    while (j < bare.length && bare[j][key] === bare[i][key]) j++;
    out.push(
      ...bare
        .slice(i, j)
        .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))
    );
    i = j;
  }
  return out;
}

export interface PinCase {
  name: string;
  body?: unknown;
  /** Expected status; the default is 200. */
  status?: number;
  /** Also run this case as every other staff role and require the same answer (default: only the first case). */
  allRoles?: boolean;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function pinEndpoint(
  path: string,
  cases: PinCase[],
  { method = "POST", tiesBy }: { method?: string; tiesBy?: string } = {}
) {
  const settle = (body: unknown) => (tiesBy ? settleTies(body, tiesBy) : body);
  const dir = `__snapshots__/${slug(path)}`;
  const call = async (role: string, body: unknown) =>
    server(path, {
      method,
      body,
      token: await tokenFor(staffEmails[role as keyof typeof staffEmails]),
      fixedClock: true,
    });

  describe(`${method} ${path}`, () => {
    cases.forEach((c, i) => {
      it(`answer: ${c.name}`, async () => {
        const r = await call("admin", c.body);
        expect(r.status).toBe(c.status ?? 200);
        await expect(
          JSON.stringify(
            normalise({ status: r.status, body: settle(r.json) }),
            null,
            2
          ) + "\n"
        ).toMatchFileSnapshot(
          `${dir}/${String(i + 1).padStart(2, "0")}-${slug(c.name)}.json`
        );
      });
    });

    for (const role of staffRoles.filter((r) => r !== "admin")) {
      it(`${role} gets the same answers as admin`, async () => {
        for (const c of cases.filter((x, i) => i === 0 || x.allRoles)) {
          const [a, b] = [
            await call("admin", c.body),
            await call(role, c.body),
          ];
          expect(b.status, c.name).toBe(a.status);
          expect(normalise(settle(b.json)), c.name).toEqual(
            normalise(settle(a.json))
          );
        }
      });
    }

    it("a jobseeker is refused (403), a request with no token gets 401, a bad token 403", async () => {
      const body = cases[0].body;
      const jobseeker = await server(path, {
        method,
        body,
        token: await tokenFor(jobseekerEmails.sin),
        fixedClock: true,
      });
      expect(jobseeker.status).toBe(403);
      expect(jobseeker.json).toEqual({
        error: "Access denied",
        message: "This resource is only accessible to: admin, recruiter",
      });
      const anon = await server(path, { method, body, fixedClock: true });
      expect(anon.status).toBe(401);
      expect(anon.json).toEqual({ error: "Missing authentication token" });
      const bad = await server(path, {
        method,
        body,
        token: "not-a-token",
        fixedClock: true,
      });
      expect(bad.status).toBe(403);
      expect(bad.json).toEqual({ error: "Invalid or expired token" });
    });
  });
}
