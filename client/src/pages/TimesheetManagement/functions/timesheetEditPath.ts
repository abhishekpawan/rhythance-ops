/** The part of a timesheet the edit link reads (a list row and the detail answer both have it). */
interface EditableTimesheet {
  jobseeker_profiles?: { id?: string } | null;
  positions?: { id?: string; client?: string | null } | null;
  week_start_date?: string | null;
  is_bulk?: boolean | null;
}

/**
 * Where "Edit" on a timesheet goes: the entry screen, or the bulk-by-jobseeker screen for a bulk timesheet, with the
 * profile, client, position and week in the query so the screen opens on that week.
 */
export function timesheetEditPath(timesheet: EditableTimesheet): string {
  const profileId = timesheet.jobseeker_profiles?.id ?? "";
  const clientId = timesheet.positions?.client ?? "";
  const positionId = timesheet.positions?.id ?? "";
  const weekStart = timesheet.week_start_date ?? "";

  const params = new URLSearchParams();
  if (profileId) params.set("profileId", profileId);
  if (clientId) params.set("clientId", clientId);
  if (positionId) params.set("positionId", positionId);
  if (weekStart) params.set("weekStart", weekStart);

  return timesheet.is_bulk
    ? `/bulk-timesheet-management/jobseeker?${params.toString()}`
    : `/timesheet-management?${params.toString()}`;
}
