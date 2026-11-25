import { checkProfileBelongsToUser } from "./timesheet.profileCheck.js";
import { addVersionToHistory } from "./timesheet.version.js";
import { supabase } from "./timesheet.client.js";
import { withTimesheetDefaults } from "./timesheet.defaults.js";
import type {
  TimesheetInput,
  TimesheetRow,
  UpdateTimesheetResult,
} from "../types/timesheet.types.js";

export async function updateTimesheet(
  id: string,
  userId: string,
  userType: string | undefined,
  timesheetData: TimesheetInput
): Promise<UpdateTimesheetResult> {
  let existingQuery = supabase
    .from("timesheets")
    .select(
      "id, jobseeker_user_id, jobseeker_profile_id, week_start_date, position_id, pay_split_segment, is_bulk, version, version_history"
    )
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

  if (
    timesheetData.jobseeker_profile_id !== undefined ||
    timesheetData.jobseeker_user_id !== undefined
  ) {
    const profileError = await checkProfileBelongsToUser(
      supabase,
      timesheetData.jobseeker_profile_id ??
        existingTimesheet.jobseeker_profile_id,
      timesheetData.jobseeker_user_id ?? existingTimesheet.jobseeker_user_id
    );
    if (profileError) return profileError;
  }

  const mergedWeek =
    timesheetData.week_start_date ?? existingTimesheet.week_start_date;
  const mergedPositionId =
    timesheetData.position_id ?? existingTimesheet.position_id;
  const mergedProfileId =
    timesheetData.jobseeker_profile_id ??
    existingTimesheet.jobseeker_profile_id;
  const mergedSegment =
    timesheetData.pay_split_segment ??
    existingTimesheet.pay_split_segment ??
    "single";

  const mergedIsBulk =
    timesheetData.is_bulk ?? existingTimesheet.is_bulk ?? false;

  let duplicateQuery = supabase
    .from("timesheets")
    .select("id")
    .eq("jobseeker_profile_id", mergedProfileId)
    .eq("week_start_date", mergedWeek)
    .eq("pay_split_segment", mergedSegment)
    .neq("id", id);

  if (mergedIsBulk) {
    duplicateQuery = duplicateQuery.eq("is_bulk", true);
  } else {
    duplicateQuery = duplicateQuery
      .eq("position_id", mergedPositionId)
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
      error: mergedIsBulk
        ? "Another bulk timesheet for this jobseeker, week, and pay segment already exists"
        : "Another timesheet for this jobseeker, position, week, and pay segment already exists",
      field: mergedIsBulk ? undefined : "position_id",
    };
  }

  const newVersion = (existingTimesheet.version ?? 1) + 1;
  const dbTimesheetData = {
    ...withTimesheetDefaults(timesheetData),
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
    version: newVersion,
    version_history: addVersionToHistory(
      existingTimesheet.version_history || [],
      userId,
      newVersion
    ),
  };

  const { data: updatedTimesheet, error: updateError } = await supabase
    .from("timesheets")
    .update(dbTimesheetData)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating timesheet:", updateError);
    return { success: false, status: 500, error: "Failed to update timesheet" };
  }

  return { success: true, timesheet: updatedTimesheet as TimesheetRow };
}
