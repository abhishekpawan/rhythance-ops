import { supabase } from "./timesheet.client.js";
import type {
  GetAllTimesheetsResult,
  TimesheetFilterParams,
  TimesheetListItem,
  TimesheetListQuery,
} from "../types/timesheet.types.js";

export function applyTimesheetFilters(
  query: any,
  filters: TimesheetFilterParams
) {
  const {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
    excludeBulk,
  } = filters;

  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    query = query.ilike("invoice_number", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.position_code", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.title", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.client_name", `%${searchTermTrimmed}%`);
  }

  if (jobseekerFilter && jobseekerFilter.trim().length > 0) {
    query = query.ilike(
      "jobseeker_profiles.first_name",
      `%${jobseekerFilter.trim()}%`
    );
  }

  if (positionFilter && positionFilter.trim().length > 0) {
    query = query.ilike("positions.title", `%${positionFilter.trim()}%`);
  }

  if (clientFilter && clientFilter.trim().length > 0) {
    query = query.ilike("positions.client_name", `%${clientFilter.trim()}%`);
  }

  if (invoiceNumberFilter && invoiceNumberFilter.trim().length > 0) {
    query = query.ilike("invoice_number", `%${invoiceNumberFilter.trim()}%`);
  }

  if (billingEmailFilter && billingEmailFilter.trim().length > 0) {
    query = query.ilike(
      "jobseeker_profiles.billing_email",
      `%${billingEmailFilter.trim()}%`
    );
  }

  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === "true";
    query = query.eq("email_sent", emailSentBool);
  }

  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte("week_start_date", dateRangeStart.trim());
  }

  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte("week_end_date", dateRangeEnd.trim());
  }

  if (excludeBulk) {
    const excludeBulkBool = String(excludeBulk).toLowerCase() === "true";
    if (excludeBulkBool) {
      query = query.eq("is_bulk", false);
    }
  }

  return query;
}

export async function getAllTimesheets(
  userId: string,
  userType: string | undefined,
  query: TimesheetListQuery
): Promise<GetAllTimesheetsResult> {
  const {
    page = "1",
    limit = "10",
    searchTerm = "",
    jobseekerFilter = "",
    positionFilter = "",
    clientFilter = "",
    invoiceNumberFilter = "",
    billingEmailFilter = "",
    emailSentFilter = "",
    dateRangeStart = "",
    dateRangeEnd = "",
  } = query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let baseQuery = supabase.from("timesheets").select(`
          id,
          invoice_number,
          week_start_date,
          week_end_date,
          total_jobseeker_pay,
          tax_amount,
          email_sent,
          is_bulk,
          jobseeker_profiles!inner(id, first_name, last_name, email, billing_email, hst_gst),
          positions!inner(id, title, position_code, client_name, client)
        `);

  if (userType === "jobseeker") {
    baseQuery = baseQuery.eq("jobseeker_user_id", userId);
  }

  baseQuery = applyTimesheetFilters(baseQuery, {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
  });

  let totalCountQuery = supabase
    .from("timesheets")
    .select("*", { count: "exact", head: true });

  if (userType === "jobseeker") {
    totalCountQuery = totalCountQuery.eq("jobseeker_user_id", userId);
  }

  const { count: totalCount, error: countError } = await totalCountQuery;

  if (countError) {
    console.error("Error getting total count:", countError);
    return {
      success: false,
      status: 500,
      error: "Failed to get total count of timesheets",
    };
  }

  let filteredCountQuery = supabase.from("timesheets").select(
    `
          id,
          invoice_number,
          week_start_date,
          week_end_date,
          total_jobseeker_pay,
          tax_amount,
          email_sent,
          jobseeker_profiles!inner(id, first_name, last_name, email, billing_email, hst_gst),
          positions!inner(id, title, position_code, client_name, client)
        `,
    { count: "exact", head: true }
  );

  if (userType === "jobseeker") {
    filteredCountQuery = filteredCountQuery.eq("jobseeker_user_id", userId);
  }

  filteredCountQuery = applyTimesheetFilters(filteredCountQuery, {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
  });

  const { count: filteredCount, error: filteredCountError } =
    await filteredCountQuery;

  if (filteredCountError) {
    console.error("Error getting filtered count:", filteredCountError);
    return {
      success: false,
      status: 500,
      error: "Failed to get filtered count of timesheets",
    };
  }

  const { data: timesheets, error } = await baseQuery
    .range(offset, offset + limitNum - 1)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching timesheets:", error);
    return { success: false, status: 500, error: "Failed to fetch timesheets" };
  }

  if (!timesheets || timesheets.length === 0) {
    return {
      success: true,
      timesheets: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount || 0,
        totalFiltered: filteredCount || 0,
        totalPages: Math.ceil((filteredCount || 0) / limitNum),
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  const totalFiltered = filteredCount || 0;
  const totalPages = Math.ceil(totalFiltered / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  return {
    success: true,
    timesheets: timesheets as unknown as TimesheetListItem[],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount || 0,
      totalFiltered,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
}
