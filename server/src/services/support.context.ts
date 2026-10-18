import { resolveSupportUserRoles } from "./support.permissions.js";
import { SupportTicketContext } from "../types.js";

/**
 * Strips query string and fragment/hash from a URL or path.
 */
export function stripQueryAndHash(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.split("?")[0].split("#")[0].trim();
}

/**
 * Sanitizes technical context payload attached to ticket creation.
 */
export function sanitizeSupportContext(rawContext: any, user: Express.Request["user"]): SupportTicketContext {
  const safeContext: SupportTicketContext = {};

  if (rawContext && typeof rawContext === "object") {
    if (typeof rawContext.route === "string") {
      safeContext.route = stripQueryAndHash(rawContext.route).slice(0, 500);
    }
    if (typeof rawContext.fromPage === "string") {
      safeContext.fromPage = stripQueryAndHash(rawContext.fromPage).slice(0, 500);
    }
    if (typeof rawContext.language === "string") {
      safeContext.language = rawContext.language.trim().slice(0, 50);
    }
    if (typeof rawContext.browser === "string") {
      safeContext.browser = rawContext.browser.trim().slice(0, 100);
    }
    if (typeof rawContext.os === "string") {
      safeContext.os = rawContext.os.trim().slice(0, 100);
    }
    if (typeof rawContext.build === "string") {
      safeContext.build = rawContext.build.trim().slice(0, 100);
    }

    if (Array.isArray(rawContext.consoleErrors)) {
      safeContext.consoleErrors = rawContext.consoleErrors
        .slice(0, 5)
        .map((err: unknown) => (typeof err === "string" ? err : JSON.stringify(err)).slice(0, 300));
    }

    if (Array.isArray(rawContext.failedRequests)) {
      safeContext.failedRequests = rawContext.failedRequests.slice(0, 5).map((r: any) => ({
        method: typeof r?.method === "string" ? r.method.trim().slice(0, 10) : "",
        path: stripQueryAndHash(r?.path).slice(0, 500),
        status: typeof r?.status === "number" ? r.status : Number(r?.status) || 0,
        time: typeof r?.time === "string" ? r.time.trim().slice(0, 50) : "",
      }));
    }
  }

  // Add userId, roles, and deployment from token / env
  safeContext.userId = user?.id;
  safeContext.roles = resolveSupportUserRoles(user);
  safeContext.deployment = process.env.PORTAL_NAME || "unknown";

  return safeContext;
}
