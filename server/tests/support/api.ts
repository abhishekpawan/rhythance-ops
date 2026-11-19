// Small helpers for the integration tests: sign in as a seeded account, call the real server, call the local
// Supabase directly (data API, storage, auth) with a user's own token.
import { inject } from "vitest";
import { JOBSEEKERS, PASSWORD, SIGNUP_JOBSEEKER, STAFF } from "../seed/ids.mjs";
import { signIn } from "../seed/users.mjs";

export {
  FILES,
  JOBSEEKERS,
  PASSWORD,
  SIGNUP_JOBSEEKER,
  STAFF,
} from "../seed/ids.mjs";

export const stack = () => inject("stack");
export const serverUrl = () => inject("serverUrl");
/** The second test server, whose clock stands still at 10:00 on 17 November 2026 in Toronto (for date-based answers). */
export const fixedClockServerUrl = () => inject("fixedClockServerUrl");

/** The third test server, with the staff two-step login enforced (feature flag staff_two_factor_enforced on). */
export const twoFactorServerUrl = () => inject("twoFactorServerUrl");

/** The fourth test server, with low phone-code rate limits (3 per number, 6 per address, per hour). */
export const limitedServerUrl = () => inject("limitedServerUrl");

const tokens = new Map<string, string>();

/** Access token of a seeded account; cached for the run. */
export async function tokenFor(
  email: string,
  password = PASSWORD
): Promise<string> {
  const key = `${email}\n${password}`;
  if (!tokens.has(key)) tokens.set(key, await signIn(stack(), email, password));
  return tokens.get(key) as string;
}

/** A fresh sign-in, for after the account's data changed (a token carries the metadata it was issued with). */
export async function freshToken(
  email: string,
  password = PASSWORD
): Promise<string> {
  return signIn(stack(), email, password);
}

export const staffEmails = Object.fromEntries(
  Object.entries(STAFF).map(([role, a]) => [role, a.email])
) as Record<keyof typeof STAFF, string>;
export const jobseekerEmails = Object.fromEntries(
  Object.entries(JOBSEEKERS).map(([k, a]) => [k, a.email])
) as Record<keyof typeof JOBSEEKERS, string>;
export const signupEmail = SIGNUP_JOBSEEKER.email;

export interface Reply {
  status: number;
  json: any;
  text: string;
}

async function reply(res: Response): Promise<Reply> {
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}

/** Calls the real server. `token` undefined sends no Authorization header. `fixedClock` uses the second server. */
export async function server(
  path: string,
  opts: {
    token?: string;
    method?: string;
    body?: unknown;
    fixedClock?: boolean;
    twoFactor?: boolean;
    limited?: boolean;
  } = {}
): Promise<Reply> {
  const base = opts.limited
    ? limitedServerUrl()
    : opts.twoFactor
      ? twoFactorServerUrl()
      : opts.fixedClock
        ? fixedClockServerUrl()
        : serverUrl();
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return reply(res);
}

/** Calls the local Supabase directly. `token` undefined means the anon key only; `key` is the apikey header. */
export async function supabase(
  path: string,
  opts: {
    token?: string;
    key?: string;
    method?: string;
    body?: unknown;
    raw?: BodyInit;
    headers?: Record<string, string>;
  } = {}
): Promise<Reply> {
  const s = stack();
  const key = opts.key ?? s.anonKey;
  const res = await fetch(`${s.apiUrl}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${opts.token ?? key}`,
      ...(opts.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...opts.headers,
    },
    body:
      opts.raw ??
      (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  return reply(res);
}

/** Storage helpers (direct, with the caller's token). */
export const storage = {
  list: (bucket: string, prefix: string, token?: string) =>
    supabase(`/storage/v1/object/list/${bucket}`, {
      token,
      method: "POST",
      body: { prefix, limit: 100 },
    }),
  download: (bucket: string, name: string, token?: string) =>
    supabase(`/storage/v1/object/authenticated/${bucket}/${name}`, { token }),
  replace: (bucket: string, name: string, content: string, token?: string) =>
    supabase(`/storage/v1/object/${bucket}/${name}`, {
      token,
      method: "PUT",
      raw: content,
      headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
    }),
  upload: (bucket: string, name: string, content: string, token?: string) =>
    supabase(`/storage/v1/object/${bucket}/${name}`, {
      token,
      method: "POST",
      raw: content,
      headers: { "Content-Type": "application/pdf" },
    }),
  remove: (bucket: string, name: string, token?: string) =>
    supabase(`/storage/v1/object/${bucket}`, {
      token,
      method: "DELETE",
      body: { prefixes: [name] },
    }),
  /** What the service key sees: used to check that a refused change really changed nothing. */
  async existsAsService(
    bucket: string,
    name: string
  ): Promise<{ exists: boolean; content?: string }> {
    const s = stack();
    const r = await supabase(`/storage/v1/object/${bucket}/${name}`, {
      token: s.serviceKey,
      key: s.serviceKey,
    });
    return r.status === 200
      ? { exists: true, content: r.text }
      : { exists: false };
  },
};
