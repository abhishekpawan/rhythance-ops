import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { TimesheetListItem } from "../../../services/api/timesheet";

export function useTimesheetNavigation() {
  const navigate = useNavigate();

  const handleViewTimesheet = useCallback(
    (timesheet: TimesheetListItem) => {
      if (timesheet.id) {
        navigate(`/timesheet-management/view/${timesheet.id}`);
      }
    },
    [navigate]
  );

  const handleEditTimesheet = useCallback(
    (timesheet: TimesheetListItem) => {
      const profileId = timesheet.jobseeker_profiles?.id ?? "";
      const clientId = timesheet.positions?.client ?? "";
      const positionId = timesheet.positions?.id ?? "";
      const weekStart = timesheet.week_start_date ?? "";

      const params = new URLSearchParams();
      if (profileId) params.set("profileId", profileId);
      if (clientId) params.set("clientId", clientId);
      if (positionId) params.set("positionId", positionId);
      if (weekStart) params.set("weekStart", weekStart);

      if (timesheet.is_bulk) {
        navigate(`/bulk-timesheet-management/jobseeker?${params.toString()}`);
      } else {
        navigate(`/timesheet-management?${params.toString()}`);
      }
    },
    [navigate]
  );

  return { handleViewTimesheet, handleEditTimesheet };
}
