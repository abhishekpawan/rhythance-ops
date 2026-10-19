/**
 * Type definitions for the Rhythence Ops Portal
 */

/**
 * Document object structure
 */
export interface Document {
  documentType: string;
  documentTitle?: string;
  documentFile?: File;
  documentNotes?: string;
  documentPath?: string;
  documentFileName?: string;
  id?: string;
}

/**
 * Profile data structure used in the API
 */
export interface ProfileData {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  mobile: string;
  licenseNumber?: string;
  passportNumber?: string;
  sinNumber?: string;
  sinExpiry?: string;
  businessNumber?: string;
  corporationName?: string;

  // Address fields
  street: string;
  city: string;
  province: string;
  postalCode: string;

  // Qualifications fields
  workPreference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  licenseType: string;
  experience: string;
  manualDriving: "Yes" | "No" | "NA";
  availability: "Full-Time" | "Part-Time";
  weekendAvailability: boolean;

  // Compensation fields
  payrateType: "Hourly" | "Daily" | "Monthly";
  billRate: string;
  payRate: string;
  paymentMethod: string;
  hstGst?: string;
  cashDeduction?: string;
  sinPayrollHoursCap?: string;
  overtimeEnabled: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;

  // Employee identification
  employeeId?: string;

  // Document fields - now an array of documents
  documents: Document[];

  // Meta fields - used internally
  verificationStatus?: "pending" | "verified" | "rejected";
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Database schema for jobseeker_profiles table
 */
export interface DbJobseekerProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  email: string;
  mobile: string;
  license_number?: string;
  passport_number?: string;
  sin_number?: string;
  sin_expiry?: string;
  work_permit_uci?: string;
  work_permit_expiry?: string;
  business_number?: string;
  corporation_name?: string;

  // Address fields
  street: string;
  city: string;
  province: string;
  postal_code: string;

  // Qualifications fields
  work_preference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  license_type: string;
  experience: string;
  manual_driving: string;
  availability: string;
  weekend_availability: boolean;

  // Compensation fields
  payrate_type: string;
  bill_rate: string;
  pay_rate: string;
  payment_method: string;
  hst_gst?: string;
  cash_deduction?: string;
  sin_payroll_hours_cap?: number | string | null;
  overtime_enabled: boolean;
  overtime_hours?: string;
  overtime_bill_rate?: string;
  overtime_pay_rate?: string;

  // Employee identification
  employee_id?: string;

  // Document fields - JSONB array in database
  documents: Document[];

  // Meta fields
  verification_status: string;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Client data structure used in the API
 */
export interface ClientData {
  // Basic Details
  companyName: string;
  billingName: string;
  shortCode?: string;
  listName?: string;
  website?: string;
  clientManager?: string;
  salesPerson?: string;
  accountingPerson?: string;
  accountingManager?: string;
  clientRep?: string;
  mergeInvoice: boolean;
  currency: "CAD" | "USD";
  workProvince: string;
  wsibCode?: string;

  // Contact Details
  contactPersonName1: string;
  emailAddress1: string;
  mobile1: string;
  contactPersonName2?: string;
  emailAddress2?: string;
  invoiceCC2: boolean;
  mobile2?: string;
  contactPersonName3?: string;
  emailAddress3?: string;
  invoiceCC3: boolean;
  mobile3?: string;
  dispatchDeptEmail?: string;
  invoiceCCDispatch: boolean;
  accountsDeptEmail?: string;
  invoiceCCAccounts: boolean;
  invoiceLanguage: "English" | "French";

  // Address Details
  streetAddress1: string;
  city1: string;
  province1: string;
  postalCode1: string;
  streetAddress2?: string;
  city2?: string;
  province2?: string;
  postalCode2?: string;
  streetAddress3?: string;
  city3?: string;
  province3?: string;
  postalCode3?: string;

  // Payment & Billings
  preferredPaymentMethod: string;
  terms: string;
  payCycle: string;
  creditLimit: string;
  notes?: string;

  // Status and meta fields
  isDraft?: boolean;
  lastUpdated?: string;
}

/**
 * Database schema for clients table
 */
export interface DbClientData {
  id: string;

  // Basic Details
  company_name: string;
  billing_name: string;
  short_code?: string;
  list_name?: string;
  website?: string;
  client_manager?: string;
  sales_person?: string;
  accounting_person?: string;
  accounting_manager?: string;
  client_rep?: string;
  merge_invoice: boolean;
  currency: string;
  work_province: string;
  wsib_code?: string;

  // Contact Details
  contact_person_name1: string;
  email_address1: string;
  mobile1: string;
  contact_person_name2?: string;
  email_address2?: string;
  invoice_cc2: boolean;
  mobile2?: string;
  contact_person_name3?: string;
  email_address3?: string;
  invoice_cc3: boolean;
  mobile3?: string;
  dispatch_dept_email?: string;
  invoice_cc_dispatch: boolean;
  accounts_dept_email?: string;
  invoice_cc_accounts: boolean;
  invoice_language: string;

  // Address Details
  street_address1: string;
  city1: string;
  province1: string;
  postal_code1: string;
  street_address2?: string;
  city2?: string;
  province2?: string;
  postal_code2?: string;
  street_address3?: string;
  city3?: string;
  province3?: string;
  postal_code3?: string;

  // Payment & Billings
  preferred_payment_method: string;
  terms: string;
  pay_cycle: string;
  credit_limit: string;
  notes?: string;

  // Meta fields
  is_draft: boolean;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
}

/** One row in position_subcategory_position_details / draft JSON */
export interface SubcategoryPositionDetailInput {
  subcategoryPosition: string;
  payrateType: string;
  numberOfPositions: number;
  regularPayRate: string;
  premiumPayRate?: string;
  markup?: string;
  billRate: string;
}

// Position Data Types
export interface PositionData {
  id?: string;

  // Basic Details
  client?: string; // Client ID
  clientName?: string; // For display only
  title?: string;
  positionCode?: string;
  startDate?: string;
  endDate?: string;
  showOnJobPortal?: boolean;
  stat?: boolean;
  clientManager?: string;
  salesManager?: string;
  positionNumber?: string;
  description?: string;

  // Address Details
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;

  // Employment Categorization
  employmentTerm?: string; // Permanent/Contract/Temporary
  employmentType?: string; // Full-Time/Part-Time
  positionCategory?: string; // Admin/AZ/etc.
  experience?: string;

  // Documents Required
  documentsRequired?: {
    license?: boolean;
    driverAbstract?: boolean;
    tdgCertificate?: boolean;
    sin?: boolean;
    immigrationStatus?: boolean;
    passport?: boolean;
    cvor?: boolean;
    resume?: boolean;
    articlesOfIncorporation?: boolean;
    directDeposit?: boolean;
  };

  // Position Details
  payrateType?: string; // Hourly/Daily/Monthly
  numberOfPositions?: number;
  regularPayRate?: string;
  premiumPayRate?: string;
  markup?: string;
  billRate?: string;

  // Overtime
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;

  // Payment & Billings
  preferredPaymentMethod?: string;
  terms?: string;

  // Notes & Task
  notes?: string;
  assignedTo?: string;
  projCompDate?: string;
  taskTime?: string;

  // Metadata
  isDraft?: boolean;
  isSubcategory?: boolean;
  /** Selected labels from dropdown list_type subcategory_position */
  subcategoryPosition?: string[] | null;
  /** Per-label rate rows (subcategory positions only); persisted in position_subcategory_position_details */
  subcategoryPositionDetails?: SubcategoryPositionDetailInput[];
  /** Form-only: mirrored from route / edit load; strip before DB insert */
  isSubcategoryForm?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;

  // Auth metadata
  createdByUserId?: string;
  updatedByUserId?: string;
}

// Database version of position data (snake_case)
export interface DbPositionData {
  id?: string;

  // Basic Details
  client?: string;
  title?: string;
  position_code?: string;
  start_date?: string;
  end_date?: string;
  show_on_job_portal?: boolean;
  stat?: boolean;
  client_manager?: string;
  sales_manager?: string;
  position_number?: string;
  description?: string;

  // Address Details
  use_client_address?: boolean;
  street_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;

  // Employment Categorization
  employment_term?: string;
  employment_type?: string;
  position_category?: string;
  experience?: string;

  // Documents Required
  documents_required?: {
    license?: boolean;
    driver_abstract?: boolean;
    tdg_certificate?: boolean;
    sin?: boolean;
    immigration_status?: boolean;
    passport?: boolean;
    cvor?: boolean;
    resume?: boolean;
    articles_of_incorporation?: boolean;
    direct_deposit?: boolean;
  };

  // Position Details
  payrate_type?: string;
  number_of_positions?: number;
  regular_pay_rate?: string;
  markup?: string;
  bill_rate?: string;

  // Overtime
  overtime_enabled?: boolean;
  overtime_hours?: string;
  overtime_bill_rate?: string;
  overtime_pay_rate?: string;

  // Payment & Billings
  preferred_payment_method?: string;
  terms?: string;

  // Notes & Task
  notes?: string;
  assigned_to?: string;
  proj_comp_date?: string;
  task_time?: string;

  // Metadata
  is_draft?: boolean;
  subcategory_position?: string[] | null;
  created_at?: string;
  updated_at?: string;
  last_updated?: string;

  // Auth metadata
  created_by_user_id?: string;
  updated_by_user_id?: string;
}

// ============================================================================
// Support Module Types
// ============================================================================

export type SupportTicketType = 'bug' | 'change' | 'feature' | 'question';
export type SupportTicketUrgency = 'blocked' | 'annoying' | 'not_urgent';
export type SupportTicketPriority = 'p1' | 'p2' | 'p3';
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed';
export type SupportActorKind = 'requester' | 'agent' | 'system';
export type SupportConfirmedBy = 'client' | 'auto' | 'agent';

export interface SupportTicketContext {
  route?: string;
  fromPage?: string;
  language?: string;
  browser?: string;
  os?: string;
  build?: string;
  consoleErrors?: string[];
  failedRequests?: Array<{
    method: string;
    path: string;
    status: number;
    time: string;
  }>;
  userId?: string;
  roles?: string[];
  deployment?: string;
  [key: string]: unknown;
}

export interface DbSupportTicket {
  id: string;
  ticket_number: number;
  idempotency_key: string;
  type: SupportTicketType;
  title: string;
  urgency: SupportTicketUrgency;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assigned_to?: string | null;
  requester_id?: string | null;
  requester_name: string;
  requester_email: string;
  requester_roles: string[];
  context: SupportTicketContext;
  locale: string;
  related_ticket_id?: string | null;
  effort_minutes?: number | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  confirmed_by?: SupportConfirmedBy | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  idempotencyKey?: string;
  isOwner?: boolean;
  type: SupportTicketType;
  title: string;
  urgency: SupportTicketUrgency;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedTo?: string | null;
  requesterId?: string | null;
  requesterName: string;
  requesterEmail?: string;
  requesterRoles: string[];
  context?: SupportTicketContext;
  locale: string;
  relatedTicketId?: string | null;
  effortMinutes?: number | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  confirmedBy?: SupportConfirmedBy | null;
  createdAt: string;
  updatedAt: string;
  elapsedMinutes?: number;
  messages?: SupportTicketMessage[];
  attachments?: SupportTicketAttachmentMetadata[];
  statusEvents?: SupportTicketStatusEvent[];
}

export interface DbSupportTicketMessage {
  id: string;
  ticket_id: string;
  author_id?: string | null;
  author_name: string;
  author_kind: SupportActorKind;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorId?: string | null;
  authorName: string;
  authorKind: SupportActorKind;
  body: string;
  isInternal?: boolean;
  createdAt: string;
}

export interface DbSupportTicketAttachment {
  id: string;
  ticket_id: string;
  message_id?: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by?: string | null;
  created_at: string;
}

export interface SupportTicketAttachmentMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
  messageId?: string | null;
}

export interface DbSupportTicketStatusEvent {
  id: string;
  ticket_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by?: string | null;
  created_at: string;
}

export interface SupportTicketStatusEvent {
  id: string;
  ticketId: string;
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: string | null;
  createdAt: string;
}
