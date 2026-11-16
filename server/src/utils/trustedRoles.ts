/**
 * A user's role is trusted only from app_metadata, which only the service key can write.
 * user_metadata can be changed by the signed-in user themselves (supabase.auth.updateUser), so it
 * is never used to decide access. The server writes the role to both, so screens that read
 * user_metadata keep showing it. Migration 034 copies today's roles into app_metadata and gives
 * every new account the jobseeker role until the server sets another.
 */

type Metadata = Record<string, unknown>;

export type PortalUserType = "admin" | "recruiter" | "jobseeker";

interface UserWithMetadata {
  app_metadata?: Metadata;
  user_metadata?: Metadata;
}

export function trustedRoleFields(user: UserWithMetadata): {
  user_type: unknown;
  user_role: unknown;
} {
  const app = user.app_metadata ?? {};
  if (typeof app.user_type === "string") {
    return {
      user_type: app.user_type,
      user_role: Array.isArray(app.user_role) ? app.user_role : [],
    };
  }
  // Only for a database where migration 034 has not run yet: no account there has a role in
  // app_metadata, so keep the previous behaviour until it runs.
  const meta = user.user_metadata ?? {};
  return { user_type: meta.user_type, user_role: meta.user_role };
}

/** The user with user_metadata.user_type and user_role replaced by the trusted values. */
export function withTrustedRoles<T extends UserWithMetadata>(user: T): T {
  return {
    ...user,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      ...trustedRoleFields(user),
    },
  };
}

/** The app_metadata fields to write whenever the server sets a user's role. */
export function roleAppMetadata(
  userType: PortalUserType,
  userRole: unknown
): { user_type: PortalUserType; user_role: string[] } {
  const roles = Array.isArray(userRole)
    ? userRole.filter((r): r is string => typeof r === "string")
    : [];
  return { user_type: userType, user_role: roles };
}
