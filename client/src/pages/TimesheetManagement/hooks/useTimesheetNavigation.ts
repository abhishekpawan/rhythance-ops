import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { TimesheetListItem } from "../../../services/api/timesheet";
import { timesheetEditPath } from "../functions/timesheetEditPath";

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
    (timesheet: TimesheetListItem) => navigate(timesheetEditPath(timesheet)),
    [navigate]
  );

  return { handleViewTimesheet, handleEditTimesheet };
}
