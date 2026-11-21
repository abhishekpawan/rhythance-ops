import { api } from './index';

// Calendar Event interface matching backend response
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  jobseekerId: string;
  jobseekerName: string;
  positionId: string;
  positionTitle: string;
  clientId: string;
  clientName: string;
  totalPositions: number;
  assignedCount: number;
  availablePositions: number;
  allDay?: boolean;
}

// Calendar summary statistics
interface CalendarSummary {
  totalPositions: number;
  totalJobseekers: number;
  activeAssignments: number;
}

// Enhanced calendar summary with additional metrics
export interface EnhancedCalendarSummary {
  totalPositions: number;
  totalJobseekers: number;
  activeAssignments: number;
  availablePositions: number;
  fillRate: number;
  statusBreakdown: {
    active: number;
    upcoming: number;
    completed: number;
    cancelled: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// API response structure
export interface CalendarResponse {
  events: CalendarEvent[];
  summary: CalendarSummary;
}

// API request parameters
export interface CalendarRequestParams {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  clientId?: string; // Optional filter by client
  jobseekerId?: string; // Optional filter by jobseeker
}

// Standardized API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch calendar events for the specified date range
 * @param params - Request parameters with date range and optional filters
 * @returns Promise with calendar events and summary statistics
 */
export const getCalendarEvents = async (
  params: CalendarRequestParams
): Promise<CalendarResponse> => {
  try {
    // Validate required parameters
    if (!params.startDate || !params.endDate) {
      throw new Error('startDate and endDate are required');
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
      throw new Error('Dates must be in YYYY-MM-DD format');
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });

    if (params.clientId) {
      queryParams.append('clientId', params.clientId);
    }

    if (params.jobseekerId) {
      queryParams.append('jobseekerId', params.jobseekerId);
    }

    // Make API request
    const response = await api.get<ApiResponse<CalendarResponse>>(
      `/api/calendar?${queryParams.toString()}`
    );

    // Validate response structure
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch calendar data');
    }

    return response.data.data;
  } catch (error) {
    console.error('Calendar API error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch calendar events');
  }
};

/**
 * Fetch calendar summary for the specified date range
 * @param params - Request parameters with date range and optional filters
 * @returns Promise with enhanced calendar summary statistics
 */
export const getCalendarSummary = async (
  params: CalendarRequestParams
): Promise<EnhancedCalendarSummary> => {
  try {
    // Validate required parameters
    if (!params.startDate || !params.endDate) {
      throw new Error('startDate and endDate are required');
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
      throw new Error('Dates must be in YYYY-MM-DD format');
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });

    if (params.clientId) {
      queryParams.append('clientId', params.clientId);
    }

    if (params.jobseekerId) {
      queryParams.append('jobseekerId', params.jobseekerId);
    }

    // Make API request to summary endpoint
    const response = await api.get<ApiResponse<EnhancedCalendarSummary>>(
      `/api/calendar/summary?${queryParams.toString()}`
    );

    // Validate response structure
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch calendar summary');
    }

    return response.data.data;
  } catch (error) {
    console.error('Calendar summary API error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch calendar summary');
  }
};

/**
 * Get calendar summary for today
 */
export const getCalendarSummaryForToday = async (
  clientId?: string,
  jobseekerId?: string
): Promise<EnhancedCalendarSummary> => {
  const today = new Date().toISOString().split('T')[0];
  return getCalendarSummary({
    startDate: today,
    endDate: today,
    clientId,
    jobseekerId,
  });
};

/**
 * Get calendar summary for current week
 */
export const getCalendarSummaryForWeek = async (
  date: Date = new Date(),
  clientId?: string,
  jobseekerId?: string
): Promise<EnhancedCalendarSummary> => {
  // Calculate start of week (Sunday)
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());

  // Calculate end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // Format dates as YYYY-MM-DD
  const startDateStr = startOfWeek.toISOString().split('T')[0];
  const endDateStr = endOfWeek.toISOString().split('T')[0];

  return getCalendarSummary({
    startDate: startDateStr,
    endDate: endDateStr,
    clientId,
    jobseekerId,
  });
};

/**
 * Get calendar summary for current month
 */
export const getCalendarSummaryForMonth = async (
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1,
  clientId?: string,
  jobseekerId?: string
): Promise<EnhancedCalendarSummary> => {
  // Calculate first and last day of the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month

  // Format dates as YYYY-MM-DD
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return getCalendarSummary({
    startDate: startDateStr,
    endDate: endDateStr,
    clientId,
    jobseekerId,
  });
};
