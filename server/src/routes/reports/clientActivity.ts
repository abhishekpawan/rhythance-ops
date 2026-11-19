export function checkClientInactive(
  lastActivityAt: string | null,
  createdAt: string | null
): boolean {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lastActivity = lastActivityAt
    ? new Date(lastActivityAt)
    : createdAt
      ? new Date(createdAt)
      : new Date();
  return lastActivity < thirtyDaysAgo;
}

export function checkJobseekerInactive(
  lastActivityAt: string | null,
  createdAt: string | null
): boolean {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const lastActivity = lastActivityAt
    ? new Date(lastActivityAt)
    : createdAt
      ? new Date(createdAt)
      : new Date();
  return lastActivity < sixtyDaysAgo;
}
