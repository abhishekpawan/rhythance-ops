import type { PositionData } from "../../services/api/position";

// Types and the sales tax list of the invoice page, moved out of InvoiceManagement.tsx unchanged (R-5s).

// Interface for assigned jobseeker data
export interface AssignedJobseeker {
  id?: string;
  positionCandidateAssignmentsId?: string;
  candidateId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  status: string;
  startDate: string;
  endDate?: string;
}

// Interface for invoice line items
export interface InvoiceLineItem {
  id: string;
  position: PositionData | null;
  jobseeker: AssignedJobseeker | null;
  description: string;
  hours: string;
  regularBillRate: string;
  regularPayRate: string;
  premiumPayRate?: string;
  salesTax: string;
  totalRegularHours?: number; // Calculated regular hours
  totalOvertimeHours?: number; // Calculated overtime hours
}

// Interface for supplier/PO items
export interface SupplierPOItem {
  id: string;
  selectedOption: string; // Combined supplier/PO selection
  supplierPoNumber: string;
}

// Sales tax options
export const SALES_TAX_OPTIONS = [
  "5.00% [AB]",
  "5.00% [BC]",
  "13.00% [ON]",
  "14.975% [QC]",
  "0.00% [ZERO RATED]",
  "5.00% [QC]",
];

export interface TimesheetData {
  id: string;
  totalRegularHours: number;
  totalOvertimeHours?: number;
  regularBillRate: number;
  regularPayRate: number;
  premiumPayRate?: number;
  overtimeBillRate?: number;
  overtimePayRate?: number;
  overtimeEnabled?: boolean;
  jobseekerProfile?: {
    firstName: string;
    lastName: string;
    email: string;
    jobseekerUserId?: string;
    jobseekerProfileId?: string;
    employeeId: string;
  };
  position?: {
    title: string;
    positionCode: string;
    positionId: string;
    positionNumber: string;
    positionCandidateAssignmentsId?: string;
  };
  description?: string;
  salesTax?: string;
}
