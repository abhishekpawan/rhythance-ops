// The invoice lines built from the timesheets of a date range (moved out of InvoiceManagement.tsx unchanged, R-5s).
// The page's `positions` state became a parameter; the grouping tables and the two line lists are passed in and filled.
import type { TimesheetFromAPI } from "../../services/api/invoice";
import type { PositionData } from "../../services/api/position";
import { formatCalendarDateRange } from "../../utils/dateUtils";
import type { GroupedTimesheetData } from "./timesheetLineItems";
import type { AssignedJobseeker, InvoiceLineItem } from "./invoiceTypes";

// A bulk timesheet: one grouped row per breakdown item, then the bonus and deduction rows.
export type BulkTimesheet = TimesheetFromAPI & {
  bulkBreakdown: NonNullable<TimesheetFromAPI["bulkBreakdown"]>;
};

export function addBulkTimesheetLines(
  timesheet: BulkTimesheet,
  groupedData: GroupedTimesheetData,
  deductionItems: InvoiceLineItem[],
  bonusItems: InvoiceLineItem[],
  positions: PositionData[]
) {
  let breakdownDeductionProcessed = false;
  let breakdownBonusProcessed = false;
  timesheet.bulkBreakdown.forEach((item, index) => {
    const key = `${timesheet.id}_${item.position_id}_${index}`;
    let itemTotalHours =
      (Number(item.regular_hours) || 0) + (Number(item.overtime_hours) || 0);

    const topLevelTotal =
      (timesheet.totalRegularHours || 0) + (timesheet.totalOvertimeHours || 0);

    if (
      timesheet.bulkBreakdown?.length === 1 &&
      topLevelTotal > 0 &&
      itemTotalHours !== topLevelTotal
    ) {
      itemTotalHours = topLevelTotal;
    }

    if (!groupedData[key]) {
      groupedData[key] = {
        position: {
          id: item.position_id,
          positionCode: item.position_code || "",
          positionNumber: item.position_code || "",
          title: item.position_title || "",
          regularPayRate: (item.regular_pay_rate || 0).toString(),
          premiumPayRate: "0",
          billRate: (item.regular_bill_rate || 0).toString(),
          markup: "0",
          overtimeEnabled: timesheet.overtimeEnabled,
          overtimeBillRate: (item.regular_bill_rate || 0).toString(), // Fallback
          overtimePayRate: (item.regular_pay_rate || 0).toString(), // Fallback
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
        regularBillRate: Number(item.regular_bill_rate) || 0,
        regularPayRate: Number(item.regular_pay_rate) || 0,
        premiumPayRate: 0,
        timesheetIds: [],
        description: `Work period: ${formatCalendarDateRange(
          timesheet.weekStartDate,
          timesheet.weekEndDate
        )}`,
      };
    }

    groupedData[key].totalHours += itemTotalHours;
    groupedData[key].timesheetIds.push(timesheet.id);

    // Check item level bonus
    const itemBonus = Number(item.bonus_amount) || 0;
    if (itemBonus > 0) {
      breakdownBonusProcessed = true;
      bonusItems.push({
        id: `bonus_${timesheet.id}_${item.position_id}_${index}_${Date.now()}`,
        position: groupedData[key].position,
        jobseeker: groupedData[key].jobseeker,
        description: "Bonus",
        hours: "1",
        regularBillRate: itemBonus.toString(),
        regularPayRate: "0",
        premiumPayRate: "0",
        salesTax: "13.00% [ON]",
        totalRegularHours: 1,
        totalOvertimeHours: 0,
      });
    }

    // Check item level deduction
    const itemDeduction = Number(item.deduction_amount) || 0;
    if (itemDeduction > 0) {
      breakdownDeductionProcessed = true;
      deductionItems.push({
        id: `deduction_${timesheet.id}_${item.position_id}_${index}_${Date.now()}`,
        position: groupedData[key].position,
        jobseeker: groupedData[key].jobseeker,
        description: "Deduction",
        hours: "1",
        regularBillRate: (-itemDeduction).toString(),
        regularPayRate: "0",
        premiumPayRate: "0",
        salesTax: "0.00% [ZERO RATED]",
        totalRegularHours: 1,
        totalOvertimeHours: 0,
      });
    }
  });

  // Fallback if top-level bonus exists on bulk timesheet but wasn't in items
  const topLevelBonus = Number(timesheet.bonusAmount) || 0;
  if (!breakdownBonusProcessed && topLevelBonus > 0) {
    const firstPositionId =
      timesheet.bulkBreakdown[0]?.position_id || timesheet.position.id;
    const fullPosition = positions.find((p) => p.id === firstPositionId) || {
      id: firstPositionId,
      positionCode:
        timesheet.bulkBreakdown[0]?.position_code ||
        timesheet.position.positionCode ||
        "",
      positionNumber:
        timesheet.bulkBreakdown[0]?.position_code ||
        timesheet.position.positionNumber ||
        "",
      title:
        timesheet.bulkBreakdown[0]?.position_title ||
        timesheet.position.title ||
        "",
      regularPayRate: timesheet.regularPayRate.toString(),
      premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
      billRate: timesheet.regularBillRate.toString(),
      markup: "0",
    };
    const jobseeker: AssignedJobseeker = {
      id: timesheet.jobseekerProfileId,
      candidateId: timesheet.jobseekerUserId,
      firstName: timesheet.jobseekerProfile.firstName,
      lastName: timesheet.jobseekerProfile.lastName,
      email: timesheet.jobseekerProfile.email,
      employeeId: timesheet.jobseekerProfile.employeeId,
      status: "active",
      startDate: timesheet.weekStartDate,
      endDate: timesheet.weekEndDate,
    };

    bonusItems.push({
      id: `bonus_${timesheet.id}_top_${Date.now()}`,
      position: fullPosition,
      jobseeker,
      description: "Bonus",
      hours: "1",
      regularBillRate: topLevelBonus.toString(),
      regularPayRate: "0",
      premiumPayRate: "0",
      salesTax: "13.00% [ON]",
      totalRegularHours: 1,
      totalOvertimeHours: 0,
    });
  }

  // Fallback if top-level deduction exists on bulk timesheet but wasn't in items
  const topLevelDeduction = Number(timesheet.deductionAmount) || 0;
  if (!breakdownDeductionProcessed && topLevelDeduction > 0) {
    const firstPositionId =
      timesheet.bulkBreakdown[0]?.position_id || timesheet.position.id;
    const fullPosition = positions.find((p) => p.id === firstPositionId) || {
      id: firstPositionId,
      positionCode:
        timesheet.bulkBreakdown[0]?.position_code ||
        timesheet.position.positionCode ||
        "",
      positionNumber:
        timesheet.bulkBreakdown[0]?.position_code ||
        timesheet.position.positionNumber ||
        "",
      title:
        timesheet.bulkBreakdown[0]?.position_title ||
        timesheet.position.title ||
        "",
      regularPayRate: timesheet.regularPayRate.toString(),
      premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
      billRate: timesheet.regularBillRate.toString(),
      markup: "0",
    };
    const jobseeker: AssignedJobseeker = {
      id: timesheet.jobseekerProfileId,
      candidateId: timesheet.jobseekerUserId,
      firstName: timesheet.jobseekerProfile.firstName,
      lastName: timesheet.jobseekerProfile.lastName,
      email: timesheet.jobseekerProfile.email,
      employeeId: timesheet.jobseekerProfile.employeeId,
      status: "active",
      startDate: timesheet.weekStartDate,
      endDate: timesheet.weekEndDate,
    };

    deductionItems.push({
      id: `deduction_${timesheet.id}_top_${Date.now()}`,
      position: fullPosition,
      jobseeker,
      description: "Deduction",
      hours: "1",
      regularBillRate: (-topLevelDeduction).toString(),
      regularPayRate: "0",
      premiumPayRate: "0",
      salesTax: "0.00% [ZERO RATED]",
      totalRegularHours: 1,
      totalOvertimeHours: 0,
    });
  }
}
