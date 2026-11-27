// The invoice lines built from the timesheets of a date range (moved out of InvoiceManagement.tsx unchanged, R-5s).
// The page's `positions` state became a parameter; the grouping tables and the two line lists are passed in and filled.
import type { TimesheetFromAPI } from "../../services/api/invoice";
import type { PositionData } from "../../services/api/position";
import { formatCalendarDateRange } from "../../utils/dateUtils";
import {
  addBulkTimesheetLines,
  type BulkTimesheet,
} from "./bulkTimesheetLineItems";
import { calculateLineItemHours } from "./invoiceCalculations";
import type { AssignedJobseeker, InvoiceLineItem } from "./invoiceTypes";

// Group timesheets by position and jobseeker to aggregate hours
export type GroupedTimesheetData = Record<
  string,
  {
    position: PositionData;
    jobseeker: AssignedJobseeker;
    totalHours: number;
    regularBillRate: number;
    regularPayRate: number;
    premiumPayRate: number;
    timesheetIds: string[];
    description: string;
  }
>;

function addSingleTimesheetLines(
  timesheet: TimesheetFromAPI,
  groupedData: GroupedTimesheetData,
  deductionItems: InvoiceLineItem[],
  bonusItems: InvoiceLineItem[]
) {
  // One line item per timesheet row (hybrid pay uses multiple rows per week)
  const key = timesheet.id;

  if (!groupedData[key]) {
    groupedData[key] = {
      position: {
        id: timesheet.position.id,
        positionCode: timesheet.position.positionCode,
        positionNumber: timesheet.position.positionNumber,
        title: timesheet.position.title,
        regularPayRate: timesheet.regularPayRate.toString(),
        premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
        billRate: timesheet.regularBillRate.toString(),
        markup: "0",
        overtimeEnabled: timesheet.overtimeEnabled,
        overtimeBillRate: timesheet.overtimeBillRate.toString(),
        overtimePayRate: timesheet.overtimePayRate.toString(),
      },
      jobseeker: {
        id: timesheet.jobseekerProfileId,
        candidateId: timesheet.jobseekerUserId,
        firstName: timesheet.jobseekerProfile.firstName,
        lastName: timesheet.jobseekerProfile.lastName,
        email: timesheet.jobseekerProfile.email,
        employeeId: timesheet.jobseekerProfile.employeeId,
        status: "active",
        startDate: timesheet.weekStartDate,
        endDate: timesheet.weekEndDate,
      },
      totalHours: 0,
      regularBillRate: timesheet.regularBillRate,
      regularPayRate: timesheet.regularPayRate,
      premiumPayRate: timesheet.premiumPayRate || 0,
      timesheetIds: [],
      description: `Work period: ${formatCalendarDateRange(
        timesheet.weekStartDate,
        timesheet.weekEndDate
      )}`,
    };
  }

  // Aggregate hours
  groupedData[key].totalHours +=
    timesheet.totalRegularHours + timesheet.totalOvertimeHours;
  groupedData[key].timesheetIds.push(timesheet.id);

  const bonusAmt = Number(timesheet.bonusAmount) || 0;
  if (bonusAmt > 0) {
    bonusItems.push({
      id: `bonus_${timesheet.id}_${Date.now()}`,
      position: groupedData[key].position,
      jobseeker: groupedData[key].jobseeker,
      description: "Bonus",
      hours: "1",
      regularBillRate: bonusAmt.toString(),
      regularPayRate: "0",
      premiumPayRate: "0",
      salesTax: "13.00% [ON]",
      totalRegularHours: 1,
      totalOvertimeHours: 0,
    });
  }

  const deductionAmt = Number(timesheet.deductionAmount) || 0;
  if (deductionAmt > 0) {
    deductionItems.push({
      id: `deduction_${timesheet.id}_${Date.now()}`,
      position: groupedData[key].position,
      jobseeker: groupedData[key].jobseeker,
      description: "Deduction",
      hours: "1",
      regularBillRate: (-deductionAmt).toString(),
      regularPayRate: "0",
      premiumPayRate: "0",
      salesTax: "0.00% [ZERO RATED]",
      totalRegularHours: 1,
      totalOvertimeHours: 0,
    });
  }
}

export function buildTimesheetLineItems(
  timesheets: TimesheetFromAPI[],
  positions: PositionData[]
): InvoiceLineItem[] {
  const groupedData: GroupedTimesheetData = {};

  const deductionItems: InvoiceLineItem[] = [];
  const bonusItems: InvoiceLineItem[] = [];

  timesheets.forEach((timesheet: TimesheetFromAPI) => {
    if (
      timesheet.isBulk &&
      Array.isArray(timesheet.bulkBreakdown) &&
      timesheet.bulkBreakdown.length > 0
    ) {
      addBulkTimesheetLines(
        timesheet as BulkTimesheet,
        groupedData,
        deductionItems,
        bonusItems,
        positions
      );
    } else {
      addSingleTimesheetLines(
        timesheet,
        groupedData,
        deductionItems,
        bonusItems
      );
    }
  });

  // Convert grouped data to line items
  const workLineItems: InvoiceLineItem[] = Object.values(groupedData).map(
    (data, index) => {
      // Find position with overtime data
      const fullPosition =
        positions.find((p) => p.id === data.position.id) || data.position;

      // Calculate hours breakdown
      const { regularHours, overtimeHours } = calculateLineItemHours(
        data.totalHours,
        fullPosition
      );

      return {
        id: `timesheet_${Date.now()}_${index}`,
        position: fullPosition,
        jobseeker: data.jobseeker,
        description: data.description,
        hours: data.totalHours.toString(),
        regularBillRate: data.regularBillRate.toString(),
        regularPayRate: data.regularPayRate.toString(),
        premiumPayRate: data.premiumPayRate.toString(),
        salesTax: "13.00% [ON]", // Default tax, can be changed by user
        totalRegularHours: regularHours,
        totalOvertimeHours: overtimeHours,
      };
    }
  );

  const newLineItems: InvoiceLineItem[] = [
    ...workLineItems,
    ...bonusItems,
    ...deductionItems,
  ];

  return newLineItems;
}
