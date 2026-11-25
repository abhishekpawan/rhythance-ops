import axios from "axios";
import { api, clearCacheFor } from "./index";
import type {
  TimesheetInput,
  TimesheetListFilters,
  PaginatedTimesheetsResponse,
  PaginatedJobseekerTimesheetsResponse,
  TimesheetMutationResponse,
  TimesheetWithJoins,
  GenerateInvoiceNumberResponse,
  SendTimesheetEmailResponse,
  DeleteTimesheetResponse,
} from "../types/timesheet";

export type {
  TimesheetInput,
  TimesheetListItem,
  TimesheetWithJoins,
  TimesheetListFilters,
  PaginatedTimesheetsResponse,
  PaginatedJobseekerTimesheetsResponse,
  TimesheetMutationResponse,
  DeleteTimesheetResponse,
} from "../types/timesheet";

export const getTimesheets = async (
  params: TimesheetListFilters = {}
): Promise<PaginatedTimesheetsResponse> => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.searchTerm) queryParams.append("searchTerm", params.searchTerm);
    if (params.jobseekerFilter)
      queryParams.append("jobseekerFilter", params.jobseekerFilter);
    if (params.positionFilter)
      queryParams.append("positionFilter", params.positionFilter);
    if (params.clientFilter)
      queryParams.append("clientFilter", params.clientFilter);
    if (params.invoiceNumberFilter)
      queryParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.billingEmailFilter)
      queryParams.append("billingEmailFilter", params.billingEmailFilter);
    if (params.emailSentFilter)
      queryParams.append("emailSentFilter", params.emailSentFilter);
    if (params.dateRangeStart)
      queryParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd)
      queryParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.excludeBulk !== undefined)
      queryParams.append("excludeBulk", params.excludeBulk.toString());

    const response = await api.get<PaginatedTimesheetsResponse>(
      `/api/timesheets?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch timesheets"
      );
    }
    throw error;
  }
};

export const getTimesheet = async (id: string): Promise<TimesheetWithJoins> => {
  try {
    const response = await api.get<TimesheetWithJoins>(`/api/timesheets/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch timesheet");
    }
    throw error;
  }
};

export const createTimesheet = async (
  timesheetData: TimesheetInput
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.post<TimesheetMutationResponse>(
      "/api/timesheets",
      timesheetData
    );
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to create timesheet"
      );
    }
    throw error;
  }
};

export const updateTimesheet = async (
  id: string,
  timesheetData: TimesheetInput
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.put<TimesheetMutationResponse>(
      `/api/timesheets/${id}`,
      timesheetData
    );
    clearCacheFor(`/api/timesheets/${id}`);
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update timesheet"
      );
    }
    throw error;
  }
};

export const updateTimesheetDocument = async (
  id: string,
  document: string
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.patch<TimesheetMutationResponse>(
      `/api/timesheets/${id}/document`,
      { document }
    );
    clearCacheFor(`/api/timesheets/${id}`);
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update timesheet document"
      );
    }
    throw error;
  }
};

export const deleteTimesheet = async (
  id: string
): Promise<DeleteTimesheetResponse> => {
  try {
    const response = await api.delete<DeleteTimesheetResponse>(
      `/api/timesheets/${id}`
    );
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete timesheet"
      );
    }
    throw error;
  }
};

export const getJobseekerTimesheets = async (
  userId: string,
  params: TimesheetListFilters = {}
): Promise<PaginatedJobseekerTimesheetsResponse> => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.searchTerm) queryParams.append("searchTerm", params.searchTerm);
    if (params.positionFilter)
      queryParams.append("positionFilter", params.positionFilter);
    if (params.clientFilter)
      queryParams.append("clientFilter", params.clientFilter);
    if (params.invoiceNumberFilter)
      queryParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.emailSentFilter)
      queryParams.append("emailSentFilter", params.emailSentFilter);
    if (params.dateRangeStart)
      queryParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd)
      queryParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.excludeBulk !== undefined)
      queryParams.append("excludeBulk", params.excludeBulk.toString());

    const response = await api.get<PaginatedJobseekerTimesheetsResponse>(
      `/api/timesheets/jobseeker/${userId}?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching jobseeker timesheets:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker timesheets"
      );
    }
    throw error;
  }
};

export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get<GenerateInvoiceNumberResponse>(
      "/api/timesheets/generate-invoice-number"
    );
    return response.data.invoice_number;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to generate invoice number"
      );
    }
    throw error;
  }
};

export const sendTimesheetEmails = async (
  id: string,
  jobseekerId?: string
): Promise<{
  success: boolean;
  message: string;
  emailsSent: string[];
  emailsSkipped: string[];
}> => {
  try {
    const response = await api.post<SendTimesheetEmailResponse>(
      `/api/timesheets/send-email/${id}`,
      jobseekerId ? { jobseekerId } : {}
    );
    return {
      success: response.data.success,
      message: response.data.message,
      emailsSent: response.data.email_sent ? [id] : [],
      emailsSkipped: response.data.email_sent ? [] : [id],
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to send emails for bulk timesheet"
      );
    }
    throw error;
  }
};
