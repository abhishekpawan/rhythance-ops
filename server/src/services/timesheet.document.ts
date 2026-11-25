import { supabase } from "./timesheet.client.js";
import type {
  TimesheetRow,
  UpdateTimesheetDocumentResult,
} from "../types/timesheet.types.js";

export async function updateTimesheetDocument(
  id: string,
  userId: string,
  userType: string | undefined,
  document: string
): Promise<UpdateTimesheetDocumentResult> {
  if (!document || typeof document !== "string") {
    return {
      success: false,
      status: 400,
      error: "Document field is required and must be a string",
    };
  }

  let existingQuery = supabase
    .from("timesheets")
    .select("id, jobseeker_user_id")
    .eq("id", id);

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

  const { data: updatedTimesheet, error: updateError } = await supabase
    .from("timesheets")
    .update({
      document,
      updated_by_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating timesheet document:", updateError);
    return {
      success: false,
      status: 500,
      error: "Failed to update timesheet document",
    };
  }

  return { success: true, timesheet: updatedTimesheet as TimesheetRow };
}
