import { supabase } from "./timesheet.client.js";
import type {
  GenerateInvoiceNumberResult,
  GetJobseekerTimesheetsResult,
  GetTimesheetByIdResult,
  TimesheetJobseekerListQuery,
  TimesheetWithJoins,
} from "../types/timesheet.types.js";

export async function generateInvoiceNumber(): Promise<GenerateInvoiceNumberResult> {
  const { data: maxInvoiceData, error: maxInvoiceError } = await supabase
    .from("timesheets")
    .select("invoice_number")
    .not("invoice_number", "is", null)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (maxInvoiceError) {
    console.error("Error fetching max invoice number:", maxInvoiceError);
    return {
      success: false,
      status: 500,
      error: "Failed to generate invoice number",
    };
  }

  let nextInvoiceNumber: string;

  if (!maxInvoiceData || maxInvoiceData.length === 0) {
    nextInvoiceNumber = "000001";
  } else {
    const currentMax = maxInvoiceData[0].invoice_number;
    const currentNumber = parseInt(currentMax, 10);
    const nextNumber = currentNumber + 1;
    nextInvoiceNumber = nextNumber.toString().padStart(6, "0");
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("timesheets")
    .select("id")
    .eq("invoice_number", nextInvoiceNumber)
    .maybeSingle();

  if (existingError) {
    console.error("Error checking existing invoice number:", existingError);
    return {
      success: false,
      status: 500,
      error: "Failed to validate invoice number",
    };
  }

  if (existingInvoice) {
    const nextNumber = parseInt(nextInvoiceNumber, 10) + 1;
    nextInvoiceNumber = nextNumber.toString().padStart(6, "0");
  }

  return {
    success: true,
    invoice_number: nextInvoiceNumber,
  };
}

export async function getTimesheetById(
  id: string,
  userId: string,
  userType: string | undefined
): Promise<GetTimesheetByIdResult> {
  let query = supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email, hst_gst, payment_method, cash_deduction),
          positions(id, position_code, title, client, client_name)
        `
    )
    .eq("id", id);

  if (userType === "jobseeker") {
    query = query.eq("jobseeker_user_id", userId);
  }

  const { data: timesheet, error } = await query.single();

  if (error) {
    console.error("Error fetching timesheet:", error);
    return { success: false, status: 404, error: "Timesheet not found" };
  }

  return { success: true, data: timesheet as TimesheetWithJoins };
}

export async function getJobseekerTimesheets(
  jobseekerUserId: string,
  userType: string | undefined,
  requestUserId: string,
  query: TimesheetJobseekerListQuery
): Promise<GetJobseekerTimesheetsResult> {
  if (userType === "jobseeker" && jobseekerUserId !== requestUserId) {
    return {
      success: false,
      status: 403,
      error: "You can only access your own timesheets",
    };
  }

  const {
    page = "1",
    limit = "10",
    dateRangeStart = "",
    dateRangeEnd = "",
  } = query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let dbQuery = supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `
    )
    .eq("jobseeker_user_id", jobseekerUserId);

  if (dateRangeStart) {
    dbQuery = dbQuery.gte("week_start_date", dateRangeStart);
  }
  if (dateRangeEnd) {
    dbQuery = dbQuery.lte("week_end_date", dateRangeEnd);
  }

  let countQuery = supabase
    .from("timesheets")
    .select("*", { count: "exact", head: true })
    .eq("jobseeker_user_id", jobseekerUserId);

  if (dateRangeStart) {
    countQuery = countQuery.gte("week_start_date", dateRangeStart);
  }
  if (dateRangeEnd) {
    countQuery = countQuery.lte("week_end_date", dateRangeEnd);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error("Error getting count:", countError);
    return {
      success: false,
      status: 500,
      error: "Failed to get count of timesheets",
    };
  }

  const { data: timesheets, error } = await dbQuery
    .range(offset, offset + limitNum - 1)
    .order("week_start_date", { ascending: false });

  if (error) {
    console.error("Error fetching jobseeker timesheets:", error);
    return { success: false, status: 500, error: "Failed to fetch timesheets" };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limitNum);

  return {
    success: true,
    timesheets: (timesheets || []) as unknown as TimesheetWithJoins[],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}
