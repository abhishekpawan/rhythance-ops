import type { Dispatch, SetStateAction } from "react";
import type { TimesheetListItem } from "../../../services/api/timesheet";
import type { TimesheetPaginationMeta } from "../../../services/types/timesheet";

export interface TimesheetsListT {
  (key: string, options?: Record<string, string | number>): string;
}

export interface UseTimesheetsListResult {
  timesheets: TimesheetListItem[];
  loading: boolean;
  error: string | null;
  message: string | null;

  pagination: TimesheetPaginationMeta;

  invoiceNumberFilter: string;
  setInvoiceNumberFilter: Dispatch<SetStateAction<string>>;
  clientFilter: string;
  setClientFilter: Dispatch<SetStateAction<string>>;
  positionFilter: string;
  setPositionFilter: Dispatch<SetStateAction<string>>;
  jobseekerFilter: string;
  setJobseekerFilter: Dispatch<SetStateAction<string>>;
  billingEmailFilter: string;
  setBillingEmailFilter: Dispatch<SetStateAction<string>>;
  dateRangeStart: string;
  setDateRangeStart: Dispatch<SetStateAction<string>>;
  dateRangeEnd: string;
  setDateRangeEnd: Dispatch<SetStateAction<string>>;
  emailSentFilter: string;
  setEmailSentFilter: Dispatch<SetStateAction<string>>;

  sendingJobseekerEmail: Record<string, boolean>;

  timesheetToDelete: TimesheetListItem | null;
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
  deleteError: string | null;

  handlePageChange: (newPage: number) => void;
  handleLimitChange: (newLimit: number) => void;
  handleCancelDelete: () => void;
  handleConfirmDelete: () => Promise<void>;
  handleDeleteTimesheet: (timesheet: TimesheetListItem) => void;
  handleViewTimesheet: (timesheet: TimesheetListItem) => void;
  sendEmailToJobseeker: (
    timesheetId: string,
    jobseekerName: string
  ) => Promise<void>;
  handleEditTimesheet: (timesheet: TimesheetListItem) => void;
}
