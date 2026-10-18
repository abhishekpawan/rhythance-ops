/**
 * Role & Permission Helpers for Support module
 */

/**
 * Normalizes legacy role names to current system role names.
 * Existing server normalization: manager -> recruiter_manager, accountant -> bookkeeper.
 */
export function normalizeRoleName(role: string): string {
  const r = role.toLowerCase().trim();
  if (r === "manager") return "recruiter_manager";
  if (r === "accountant") return "bookkeeper";
  return r;
}

/**
 * Resolves all normalized roles for a user from user_metadata.
 */
export function resolveSupportUserRoles(user: Express.Request["user"] | undefined): string[] {
  if (!user) return [];
  const rawType = user.user_metadata?.user_type;
  if (rawType === "jobseeker") {
    return ["jobseeker"];
  }

  const rawRoles = user.user_metadata?.user_role;
  const roles: string[] = [];

  if (Array.isArray(rawRoles)) {
    for (const r of rawRoles) {
      if (typeof r === "string") roles.push(r);
    }
  } else if (typeof rawRoles === "string") {
    roles.push(rawRoles);
  }

  if (rawType === "admin" && !roles.includes("admin")) {
    roles.push("admin");
  } else if (rawType === "recruiter" && roles.length === 0) {
    roles.push("recruiter");
  }

  const normalized = roles.map(normalizeRoleName);
  return Array.from(new Set(normalized));
}

/**
 * Resolves a display name for a user from user_metadata or email.
 * Checks metadata keys:
 * 1. first_name + last_name
 * 2. firstName + lastName
 * 3. full_name
 * 4. name
 * Falls back to email local part, then 'User'.
 */
export function resolveUserDisplayName(user: Express.Request["user"] | undefined): string {
  if (!user) return "User";
  const meta = user.user_metadata || {};

  // 1. first_name + last_name
  const firstLast = `${meta.first_name || ""} ${meta.last_name || ""}`.trim();
  if (firstLast) return firstLast;

  // 2. firstName + lastName (used in recruiterMetrics.ts)
  const camelFirstLast = `${meta.firstName || ""} ${meta.lastName || ""}`.trim();
  if (camelFirstLast) return camelFirstLast;

  // 3. full_name (used in HamburgerMenu.tsx and OAuth/Supabase auth)
  if (typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }

  // 4. name (used in user.ts, create-admin.ts, HamburgerMenu.tsx, types/auth.ts)
  if (typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }

  // 5. Email local part
  if (user.email && typeof user.email === "string" && user.email.includes("@")) {
    const localPart = user.email.split("@")[0].trim();
    if (localPart) return localPart;
  }

  return "User";
}

/**
 * Agent: user_role contains 'superadmin' (agent is also treated as sharedViewer).
 */
export function isSupportAgent(user: Express.Request["user"] | undefined): boolean {
  if (!user) return false;
  const rawRoles = user.user_metadata?.user_role;
  if (Array.isArray(rawRoles)) {
    return rawRoles.some((r) => typeof r === "string" && r.toLowerCase().trim() === "superadmin");
  }
  if (typeof rawRoles === "string") {
    return rawRoles.toLowerCase().trim() === "superadmin";
  }
  return false;
}

/**
 * Requester: any authenticated user who is not a jobseeker.
 */
export function isSupportRequester(user: Express.Request["user"] | undefined): boolean {
  if (!user) return false;
  const rawType = user.user_metadata?.user_type;
  if (rawType === "jobseeker") return false;

  const roles = resolveSupportUserRoles(user);
  if (roles.length === 1 && roles[0] === "jobseeker") return false;
  return true;
}

/**
 * SharedViewer: admin, recruiter, recruiter_manager, recruiter_director.
 * Agent is also treated as sharedViewer.
 */
export function isSupportSharedViewer(user: Express.Request["user"] | undefined): boolean {
  if (!user) return false;
  if (isSupportAgent(user)) return true;

  const roles = resolveSupportUserRoles(user);
  const sharedViewerRoles = ["admin", "recruiter", "recruiter_manager", "recruiter_director"];
  return roles.some((r) => sharedViewerRoles.includes(r));
}

/**
 * Admin: user has 'admin' role or user_type === 'admin'.
 */
export function isSupportAdmin(user: Express.Request["user"] | undefined): boolean {
  if (!user) return false;
  const roles = resolveSupportUserRoles(user);
  return roles.includes("admin") || user.user_metadata?.user_type === "admin";
}
