import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";

export const getTimesheetsByClient = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    // Fetch timesheets for the client within the date range
    // Join with positions to filter by client, and with jobseeker_profiles to get jobseeker details
    const { data: timesheets, error } = await supabase
      .from("timesheets")
      .select(
        `
        id,
        jobseeker_profile_id,
        jobseeker_user_id,
        position_id,
        week_start_date,
        week_end_date,
        total_regular_hours,
        total_overtime_hours,
        regular_pay_rate,
        premium_pay_rate,
        regular_bill_rate,
        overtime_pay_rate,
        overtime_bill_rate,
        total_jobseeker_pay,
        total_client_bill,
        overtime_enabled,
        bonus_amount,
        deduction_amount,
        invoice_number,
        is_bulk,
        bulk_breakdown,
        positions!inner(
          id,
          title,
          position_code,
          position_number,
          client
        ),
        jobseeker_profiles!inner(
          id,
          first_name,
          last_name,
          email,
          employee_id
        )
      `
      )
      .eq("positions.client", clientId)
      // Same rule as timesheetWeekWithinRange(week_start, week_end, startDate, endDate)
      .gte("week_start_date", startDate)
      .lte("week_end_date", endDate)
      .order("week_start_date", { ascending: true });

    if (error) {
      console.error("Error fetching timesheets:", error);
      return res.status(500).json({ error: "Failed to fetch timesheets" });
    }

    // Transform the data to a more usable format
    const formattedTimesheets = (timesheets || []).map((timesheet: any) => ({
      id: timesheet.id,
      jobseekerProfileId: timesheet.jobseeker_profile_id,
      jobseekerUserId: timesheet.jobseeker_user_id,
      positionId: timesheet.position_id,
      weekStartDate: timesheet.week_start_date,
      weekEndDate: timesheet.week_end_date,
      totalRegularHours: parseFloat(timesheet.total_regular_hours) || 0,
      totalOvertimeHours: parseFloat(timesheet.total_overtime_hours) || 0,
      regularPayRate: parseFloat(timesheet.regular_pay_rate) || 0,
      premiumPayRate: parseFloat(timesheet.premium_pay_rate) || 0,
      regularBillRate: parseFloat(timesheet.regular_bill_rate) || 0,
      overtimePayRate: parseFloat(timesheet.overtime_pay_rate) || 0,
      overtimeBillRate: parseFloat(timesheet.overtime_bill_rate) || 0,
      totalJobseekerPay: parseFloat(timesheet.total_jobseeker_pay) || 0,
      totalClientBill: parseFloat(timesheet.total_client_bill) || 0,
      overtimeEnabled: timesheet.overtime_enabled,
      bonusAmount: parseFloat(timesheet.bonus_amount) || 0,
      deductionAmount: parseFloat(timesheet.deduction_amount) || 0,
      invoiceNumber: timesheet.invoice_number,
      isBulk: timesheet.is_bulk,
      bulkBreakdown: timesheet.bulk_breakdown,
      position: {
        id: timesheet.positions.id,
        title: timesheet.positions.title,
        positionCode: timesheet.positions.position_code,
        positionNumber: timesheet.positions.position_number,
        clientId: timesheet.positions.client,
      },
      jobseekerProfile: {
        id: timesheet.jobseeker_profiles.id,
        firstName: timesheet.jobseeker_profiles.first_name,
        lastName: timesheet.jobseeker_profiles.last_name,
        email: timesheet.jobseeker_profiles.email,
        employeeId: timesheet.jobseeker_profiles.employee_id,
      },
    }));

    return res.status(200).json({
      success: true,
      timesheets: formattedTimesheets,
      count: formattedTimesheets.length,
    });
  } catch (error) {
    console.error("Unexpected error fetching timesheets:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
