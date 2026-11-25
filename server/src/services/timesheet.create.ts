import { checkProfileBelongsToUser } from "./timesheet.profileCheck.js";
import { initializeVersionHistory } from "./timesheet.version.js";
import { supabase } from "./timesheet.client.js";
import {
  withTimesheetDefaults,
  CREATE_REQUIRED_FIELDS,
} from "./timesheet.defaults.js";
import type {
  CreateTimesheetResult,
  TimesheetInput,
  TimesheetRow,
} from "../types/timesheet.types.js";

export async function createTimesheet(
  userId: string,
  userType: string | undefined,
  timesheetData: TimesheetInput
): Promise<CreateTimesheetResult> {
  for (const field of CREATE_REQUIRED_FIELDS) {
    if (timesheetData[field] === undefined || timesheetData[field] === null) {
      return {
        success: false,
        status: 400,
        error: `Missing required field: ${field}`,
      };
    }
  }

  const profileError = await checkProfileBelongsToUser(
    supabase,
    timesheetData.jobseeker_profile_id,
    timesheetData.jobseeker_user_id
  );
  if (profileError) return profileError;

  if (
    !timesheetData.is_bulk &&
    (timesheetData.position_id === undefined ||
      timesheetData.position_id === null)
  ) {
    return {
      success: false,
      status: 400,
      error: "Missing required field: position_id",
    };
  }

  const paySegment = timesheetData.pay_split_segment ?? "single";

  let duplicateQuery = supabase
    .from("timesheets")
    .select("id")
    .eq("jobseeker_profile_id", timesheetData.jobseeker_profile_id)
    .eq("week_start_date", timesheetData.week_start_date)
    .eq("pay_split_segment", paySegment);

  if (timesheetData.is_bulk) {
    duplicateQuery = duplicateQuery.eq("is_bulk", true);
  } else {
    duplicateQuery = duplicateQuery
      .eq("position_id", timesheetData.position_id!)
      .eq("is_bulk", false);
  }

  const { data: duplicateTimesheet, error: duplicateCheckError } =
    await duplicateQuery.maybeSingle();

  if (duplicateCheckError) {
    console.error(
      "Error checking for duplicate timesheet:",
      duplicateCheckError
    );
    return {
      success: false,
      status: 500,
      error: "Failed to validate timesheet uniqueness",
    };
  }

  if (duplicateTimesheet) {
    return {
      success: false,
      status: 409,
      error: timesheetData.is_bulk
        ? "A bulk timesheet for this jobseeker and week already exists"
        : "A timesheet for this jobseeker, position and week already exists",
      field: timesheetData.is_bulk ? undefined : "position_id",
    };
  }

  const dbTimesheetData = {
    ...withTimesheetDefaults(timesheetData),
    created_by_user_id: userId,
    updated_by_user_id: userId,
    version: 1,
    version_history: initializeVersionHistory(userId),
  };

  const { data: newTimesheet, error: insertError } = await supabase
    .from("timesheets")
    .insert([dbTimesheetData])
    .select("*")
    .single();

  if (insertError) {
    console.error("Error creating timesheet:", insertError);
    console.error("Attempted to insert data:", dbTimesheetData);
    return {
      success: false,
      status: 500,
      error: "Failed to create timesheet",
      details: insertError.message,
      code: insertError.code,
    };
  }

  return { success: true, timesheet: newTimesheet as TimesheetRow };
}
