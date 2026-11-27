// The shapes of the invoice's saved JSON the view page reads, moved out of InvoiceView.tsx unchanged (R-5s).

export interface TimesheetItem {
  id?: string;
  description?: string;
  salesTax?: string;
  totalRegularHours?: number;
  totalOvertimeHours?: number;
  regularBillRate?: number | string;
  overtimeBillRate?: number | string;
  regularPayRate?: number | string;
  totalClientBill?: number;
  position?: {
    title?: string;
    positionCode?: string;
  };
  jobseekerProfile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    employeeId?: string;
  };
}

export interface SupplierPOItem {
  id?: string;
  selectedOption?: string;
  supplierPoNumber?: string;
}

export interface AttachmentItem {
  id?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  filePath?: string;
  url?: string;
}
