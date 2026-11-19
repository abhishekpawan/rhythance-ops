/**
 * Server-side two-step login for staff (admin and recruiter accounts).
 *
 * Staff sign in with email and password, then enter a phone code. Before this, only the login screen
 * checked the code, so anyone with the password could skip it (by calling Supabase's sign-in directly).
 * Now, when the feature flag `staff_two_factor_enforced` is on:
 *   - `POST /api/auth/complete-2fa` checks the code itself and records the new sign-in session in
 *     `staff_2fa_sessions`;
 *   - `authenticateToken` refuses a staff token whose session is not recorded (401 TWO_FACTOR_REQUIRED).
 * Jobseekers are never affected. Design and rollout: docs/role-access-control.md, "Two-step login".
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import twilio from "twilio";
import { isFeatureEnabled } from "./featureFlags.js";
import { trustedRoleFields } from "../utils/trustedRoles.js";

dotenv.config();

export const TWO_FACTOR_FLAG = "staff_two_factor_enforced";
/** A recorded session stays valid this long; after that the staff member enters a phone code again. */
const SESSION_VALID_DAYS = 90;
const CACHE_MS = 5 * 60_000;
// Postgres "undefined_table" and PostgREST "table not in schema cache": migration 035 not applied here.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY) as string
);

interface UserLike {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export const twoFactorEnforced = (): Promise<boolean> =>
  isFeatureEnabled(TWO_FACTOR_FLAG);

/** Admin and recruiter accounts, by the role only the server can write (app_metadata). */
export function isStaffUser(user: UserLike): boolean {
  const type = trustedRoleFields(user).user_type;
  return type === "admin" || type === "recruiter";
}

/** The number written by the server (migration 035, sign-up, onboarding); null if none was pinned. */
export function pinnedPhone(user: UserLike): string | null {
  const pinned = user.app_metadata?.twofa_phone;
  return typeof pinned === "string" && pinned ? pinned : null;
}

/**
 * The number the phone code is checked against. Never a number the browser sends. The pinned number
 * comes from app_metadata (users cannot edit it); an account created after migration 035 by a path that
 * does not pin falls back to the number in its profile.
 */
export function twoFactorPhone(user: UserLike): string | null {
  const pinned = pinnedPhone(user);
  if (pinned) return pinned;
  const profile = user.user_metadata?.phoneNumber;
  if (typeof profile !== "string" || !profile.trim()) return null;
  const trimmed = profile.replace(/\s+/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/** The session id inside a Supabase access token. The token was already verified by Supabase. */
export function sessionIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    );
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

/** Twilio Verify check of a code sent to `phone`. False for a wrong, expired or already used code. */
export async function checkPhoneCode(
  phone: string,
  code: string
): Promise<boolean> {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !serviceSid
  ) {
    console.error("Twilio is not configured");
    return false;
  }
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phone, code });
    return check.status === "approved";
  } catch (error) {
    console.error(
      "Two-step login code check failed:",
      error instanceof Error ? error.name : "error"
    );
    return false;
  }
}

const verifiedCache = new Map<string, number>();

/** Record that this session's phone code was verified (also tidies rows older than the validity). */
export async function recordVerifiedSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const { error } = await supabase.from("staff_2fa_sessions").upsert(
    {
      session_id: sessionId,
      user_id: userId,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
  if (error) {
    // Without the row the staff member would be refused on the next request: fail the sign-in instead.
    throw new Error(`Could not record the verified session (${error.code})`);
  }
  verifiedCache.set(sessionId, Date.now() + CACHE_MS);
  const cutoff = new Date(Date.now() - SESSION_VALID_DAYS * 86_400_000);
  void supabase
    .from("staff_2fa_sessions")
    .delete()
    .lt("verified_at", cutoff.toISOString());
}

type Lookup = "verified" | "not_verified" | "unavailable";

async function lookupSession(
  userId: string,
  sessionId: string
): Promise<Lookup> {
  const until = verifiedCache.get(sessionId);
  if (until && until > Date.now()) return "verified";
  const cutoff = new Date(Date.now() - SESSION_VALID_DAYS * 86_400_000);
  const { data, error } = await supabase
    .from("staff_2fa_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .gt("verified_at", cutoff.toISOString())
    .maybeSingle();
  if (error) {
    // Table missing = migration 035 not applied on this database: nothing to enforce yet.
    if (error.code && MISSING_TABLE_CODES.has(error.code)) return "verified";
    console.error("Two-step login session lookup failed:", error.code);
    return "unavailable";
  }
  if (!data) return "not_verified";
  verifiedCache.set(sessionId, Date.now() + CACHE_MS);
  return "verified";
}

export type GateResult = "allow" | "refuse" | "unavailable";

/**
 * Called by authenticateToken for every request. Staff only, and only when the flag is on.
 * `path` is the request path: the one call an invited staff member makes before they have a number
 * on file (complete-onboarding) is let through, and it records their session itself.
 */
export async function staffSessionGate(
  user: UserLike,
  token: string,
  path: string
): Promise<GateResult> {
  if (!isStaffUser(user)) return "allow";
  if (!(await twoFactorEnforced())) return "allow";
  const sessionId = sessionIdFromToken(token);
  if (sessionId) {
    const found = await lookupSession(user.id, sessionId);
    if (found === "verified") return "allow";
    if (found === "unavailable") return "unavailable";
  }
  if (path === "/api/auth/complete-onboarding" && !pinnedPhone(user)) {
    return "allow";
  }
  return "refuse";
}
