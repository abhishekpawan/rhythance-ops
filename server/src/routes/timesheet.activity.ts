import { Request, Response } from "express";
import { activityLogger } from "../middleware/activityLogger.js";
import { supabase } from "../services/timesheet.service.js";
import type { TimesheetInput } from "../types/timesheet.types.js";

// The activity-log entries of the timesheet routes (moved out of timesheet.routes.ts unchanged).

export const sendEmailActivity = activityLogger({
  onSuccess: (req, res) => {
    const { id } = req.params;
    const result = res.locals.timesheetSendResult || res.locals.timesheet || {};
    return {
      actionType: "send_bulk_timesheet_email",
      actionVerb: "sent email",
      primaryEntityType: "timesheet",
      primaryEntityId: id,
      primaryEntityName: result.invoice_number || id,
      displayMessage: `Sent timesheet email for invoice ${
        result.invoice_number || id
      } to ${result.jobseeker_name || "jobseeker"}`,
      category: "financial",
      priority: "normal",
      metadata: {
        invoice_number: result.invoice_number,
        jobseeker_name: result.jobseeker_name,
        email_sent: result.email_sent,
      },
    };
  },
});

export const createActivity = activityLogger({
  onSuccess: async (req: Request, res: Response) => {
    const timesheetData = req.body as TimesheetInput;
    const newTimesheet = res.locals.newTimesheet;

    let jobseekerName = "Unknown Jobseeker";
    if (timesheetData.jobseeker_profile_id) {
      try {
        const { data: profile } = await supabase
          .from("jobseeker_profiles")
          .select("first_name, last_name")
          .eq("id", timesheetData.jobseeker_profile_id)
          .single();
        if (profile) {
          jobseekerName = `${profile.first_name} ${profile.last_name}`;
        }
      } catch {
        console.warn("Could not fetch jobseeker name for activity log");
      }
    }

    let positionTitle = "Unknown Position";
    if (timesheetData.position_id) {
      try {
        const { data: position } = await supabase
          .from("positions")
          .select("title, position_code")
          .eq("id", timesheetData.position_id)
          .single();
        if (position) {
          positionTitle = position.title || position.position_code;
        }
      } catch {
        console.warn("Could not fetch position title for activity log");
      }
    }

    return {
      actionType: "create_timesheet",
      actionVerb: "created",
      primaryEntityType: "timesheet",
      primaryEntityId: newTimesheet?.id,
      primaryEntityName: `Timesheet for week ${timesheetData.week_start_date}`,
      secondaryEntityType: "jobseeker",
      secondaryEntityId: timesheetData.jobseeker_profile_id,
      secondaryEntityName: jobseekerName,
      tertiaryEntityType: "position",
      tertiaryEntityId: timesheetData.position_id,
      tertiaryEntityName: positionTitle,
      displayMessage: `Created timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.week_start_date}`,
      category: "financial",
      priority: "normal" as const,
      metadata: {
        week_start_date: timesheetData.week_start_date,
        week_end_date: timesheetData.week_end_date,
        total_regular_hours: timesheetData.total_regular_hours,
        total_overtime_hours: timesheetData.total_overtime_hours,
        total_jobseeker_pay: timesheetData.total_jobseeker_pay,
        total_client_bill: timesheetData.total_client_bill,
        invoice_number: timesheetData.invoice_number,
      },
    };
  },
});

export const updateActivity = activityLogger({
  onSuccess: async (req: Request) => {
    const timesheetData = req.body as TimesheetInput;
    const { id } = req.params;

    let jobseekerName = "Unknown Jobseeker";
    if (timesheetData.jobseeker_profile_id) {
      try {
        const { data: profile } = await supabase
          .from("jobseeker_profiles")
          .select("first_name, last_name")
          .eq("id", timesheetData.jobseeker_profile_id)
          .single();
        if (profile) {
          jobseekerName = `${profile.first_name} ${profile.last_name}`;
        }
      } catch {
        console.warn("Could not fetch jobseeker name for activity log");
      }
    }

    let positionTitle = "Unknown Position";
    if (timesheetData.position_id) {
      try {
        const { data: position } = await supabase
          .from("positions")
          .select("title, position_code")
          .eq("id", timesheetData.position_id)
          .single();
        if (position) {
          positionTitle = position.title || position.position_code;
        }
      } catch {
        console.warn("Could not fetch position title for activity log");
      }
    }

    return {
      actionType: "update_timesheet",
      actionVerb: "updated",
      primaryEntityType: "timesheet",
      primaryEntityId: id,
      primaryEntityName: `Timesheet for week ${timesheetData.week_start_date}`,
      secondaryEntityType: "jobseeker",
      secondaryEntityId: timesheetData.jobseeker_profile_id,
      secondaryEntityName: jobseekerName,
      tertiaryEntityType: "position",
      tertiaryEntityId: timesheetData.position_id,
      tertiaryEntityName: positionTitle,
      displayMessage: `Updated timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.week_start_date}`,
      category: "financial",
      priority: "normal" as const,
      metadata: {
        week_start_date: timesheetData.week_start_date,
        week_end_date: timesheetData.week_end_date,
        total_regular_hours: timesheetData.total_regular_hours,
        total_overtime_hours: timesheetData.total_overtime_hours,
        total_jobseeker_pay: timesheetData.total_jobseeker_pay,
        total_client_bill: timesheetData.total_client_bill,
        invoice_number: timesheetData.invoice_number,
      },
    };
  },
});

export const deleteActivity = activityLogger({
  onSuccess: async (req: Request, res: Response) => {
    const { id } = req.params;
    const deletedTimesheet = res.locals.deletedTimesheet;

    let jobseekerName = "Unknown Jobseeker";
    if (deletedTimesheet?.jobseeker_user_id) {
      try {
        const { data: profile } = await supabase
          .from("jobseeker_profiles")
          .select("first_name, last_name")
          .eq("user_id", deletedTimesheet.jobseeker_user_id)
          .single();
        if (profile) {
          jobseekerName = `${profile.first_name} ${profile.last_name}`;
        }
      } catch {
        console.warn("Could not fetch jobseeker name for activity log");
      }
    }

    let positionTitle = "Unknown Position";
    if (deletedTimesheet?.position_id) {
      try {
        const { data: position } = await supabase
          .from("positions")
          .select("title, position_code")
          .eq("id", deletedTimesheet.position_id)
          .single();
        if (position) {
          positionTitle = position.title || position.position_code;
        }
      } catch {
        console.warn("Could not fetch position title for activity log");
      }
    }

    return {
      actionType: "delete_timesheet",
      actionVerb: "deleted",
      primaryEntityType: "timesheet",
      primaryEntityId: id,
      primaryEntityName: `Timesheet for week ${
        deletedTimesheet?.week_start_date || "Unknown"
      }`,
      secondaryEntityType: "jobseeker",
      secondaryEntityId: deletedTimesheet?.jobseeker_profile_id,
      secondaryEntityName: jobseekerName,
      tertiaryEntityType: "position",
      tertiaryEntityId: deletedTimesheet?.position_id,
      tertiaryEntityName: positionTitle,
      displayMessage: `Deleted timesheet for ${jobseekerName} (${positionTitle}) - Week ${
        deletedTimesheet?.week_start_date || "Unknown"
      }`,
      category: "financial",
      priority: "high" as const,
      metadata: {
        week_start_date: deletedTimesheet?.week_start_date,
        week_end_date: deletedTimesheet?.week_end_date,
        total_regular_hours: deletedTimesheet?.total_regular_hours,
        total_overtime_hours: deletedTimesheet?.total_overtime_hours,
        total_jobseeker_pay: deletedTimesheet?.total_jobseeker_pay,
        total_client_bill: deletedTimesheet?.total_client_bill,
        invoice_number: deletedTimesheet?.invoice_number,
      },
    };
  },
});
