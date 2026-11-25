/** Types of the hybrid SIN + cash / e-Transfer payroll split (see hybridPayrollSplit.ts). */

export type PaySplitSegment = "single" | "sin" | "cash" | "e_transfer";

export interface DailyHourEntry {
  date: string;
  hours: number;
}

export interface WeeklyHoursSplitParams {
  entries: DailyHourEntry[];
  overtimeEnabled: boolean;
  /** Raw position.overtimeHours; if missing and OT enabled, 40 is used */
  overtimeHoursRaw?: string | null;
}

export interface HybridPayrollRates {
  effectiveRegularPayRate: number;
  overtimePayRate: number;
  regularBillRate: number;
  overtimeBillRate: number;
}

export interface BuildHybridRowsInput
  extends WeeklyHoursSplitParams, HybridPayrollRates {
  paymentMethod: string;
  sinPayrollHoursCap: number;
  cashDeductionPct: number;
  bonusAmount: number;
  deductionAmount: number;
  hstGst?: string | null;
}

export interface ComputedTimesheetRow {
  paySplitSegment: PaySplitSegment;
  linePaymentMethod: string | null;
  dailyHours: DailyHourEntry[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalClientBill: number;
  totalJobseekerPay: number;
  bonusAmount: number;
  deductionAmount: number;
  taxAmount?: number;
}
