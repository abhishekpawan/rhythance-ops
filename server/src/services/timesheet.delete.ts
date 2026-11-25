import { supabase } from "./timesheet.client.js";
import type {
  DeleteTimesheetResult,
  TimesheetRow,
} from "../types/timesheet.types.js";

export async function deleteTimesheet(
  id: string,
  userId: string,
  userType: string | undefined
): Promise<DeleteTimesheetResult> {
  let existingQuery = supabase.from("timesheets").select("*").eq("id", id);

  if (userType === "jobseeker") {
    existingQuery = existingQuery.eq("jobseeker_user_id", userId);
  }

  const { data: existingTimesheet, error: timesheetCheckError } =
    await existingQuery.maybeSingle();

  if (timesheetCheckError || !existingTimesheet) {
    return {
      success: false,
      status: 404,
      error: "Timesheet not found or access denied",
    };
  }

  const { error: deleteError } = await supabase
    .from("timesheets")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting timesheet:", deleteError);
    return { success: false, status: 500, error: "Failed to delete timesheet" };
  }

  return {
    success: true,
    deleted_id: id,
    timesheet: existingTimesheet as TimesheetRow,
  };
}
