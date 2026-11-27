// Invoice management API functions
export interface InvoiceData {
  id?: string;
  invoiceNumber?: string;
  clientId: string;
  invoiceDate: string;
  dueDate: string;
  status?: string;
  currency?: string;
  paymentTerms?: string;
  subtotal: number;
  totalTax: number;
  totalHst?: number;
  totalGst?: number;
  totalQst?: number;
  grandTotal: number;
  totalHours: number;
  emailSent?: boolean;
  emailSentDate?: string;
  documentGenerated?: boolean;
  documentPath?: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentMimeType?: string;
  documentGeneratedAt?: string;
  notes?: string; // Additional notes or comments
  invoiceData: Record<string, unknown>; // Complete JSONB object from frontend
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  version?: number;

  // Related data from joins
  client?: {
    id: string;
    companyName: string;
    shortCode: string;
    emailAddress1: string;
    streetAddress1?: string;
    city1?: string;
    province1?: string;
    postalCode1?: string;
  };
  // Add invoice_sent_to field for recipient email
  invoice_sent_to?: string;
}

export interface InvoiceResponse {
  success: boolean;
  message: string;
  invoice: InvoiceData;
}

export interface InvoicePaginationParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  clientFilter?: string;
  clientEmailFilter?: string;
  invoiceNumberFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  emailSentFilter?: string;
  invoiceSentFilter?: string;
  documentGeneratedFilter?: string;
  paymentTermsFilter?: string;
}

export interface PaginatedInvoiceResponse {
  invoices: InvoiceData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalFiltered: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface InvoiceDocumentUpdateData {
  documentPath: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentGeneratedAt?: string;
  documentGenerated?: boolean;
  documentMimeType?: string;
}

/**
 * Timesheet data from API
 */
export interface TimesheetFromAPI {
  id: string;
  jobseekerProfileId: string;
  jobseekerUserId: string;
  positionId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  regularPayRate: number;
  premiumPayRate?: number;
  regularBillRate: number;
  overtimePayRate: number;
  overtimeBillRate: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  overtimeEnabled: boolean;
  bonusAmount: number;
  deductionAmount: number;
  invoiceNumber?: string;
  isBulk?: boolean;
  bulkBreakdown?: any[];
  position: {
    id: string;
    title: string;
    positionCode: string;
    positionNumber: string;
    clientId: string;
  };
  jobseekerProfile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };
}

export interface TimesheetsResponse {
  success: boolean;
  timesheets: TimesheetFromAPI[];
  count: number;
}
