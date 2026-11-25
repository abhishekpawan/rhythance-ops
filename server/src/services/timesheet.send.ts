import sgMail from "@sendgrid/mail";
import { getNoReplyFromEmail } from "../middleware/emailNotifier.js";
import { timesheetHtmlTemplate } from "../email-templates/timesheet-html.js";
import { timesheetTextTemplate } from "../email-templates/timesheet-txt.js";
import {
  effectivePremiumPayRate,
  toNum,
} from "../email-templates/timesheet-email-numeric.js";
import { supabase } from "./timesheet.client.js";
import type { SendTimesheetEmailResult } from "../types/timesheet.types.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

/** Cash / e-Transfer deduction for email templates: uses line_payment_method when set (split rows). */
export function emailCashDeductionVars(args: {
  linePaymentMethod: string | null | undefined;
  profilePaymentMethod: string | null | undefined;
  cashDeductionStr: string | null | undefined;
  totalRegularHours: number;
  regularPayRate: number;
  premiumPayRate: number;
  totalOvertimeHours: number;
  overtimePayRate: number;
}): { cash_deduction_percentage: number; cash_deduction_amount: number } {
  const pct = parseFloat(args.cashDeductionStr || "0");
  const effectivePm =
    args.linePaymentMethod && String(args.linePaymentMethod).trim() !== ""
      ? args.linePaymentMethod
      : args.profilePaymentMethod || "";
  const applies = effectivePm === "Cash" || effectivePm === "e-Transfer";
  if (!applies || pct <= 0) {
    return { cash_deduction_percentage: 0, cash_deduction_amount: 0 };
  }
  const basePay =
    toNum(args.totalRegularHours) *
      (toNum(args.regularPayRate) + toNum(args.premiumPayRate)) +
    toNum(args.totalOvertimeHours) * toNum(args.overtimePayRate);
  return {
    cash_deduction_percentage: pct,
    cash_deduction_amount: basePay * (pct / 100),
  };
}

export async function sendTimesheetEmail(
  id: string,
  userId: string | undefined,
  userType: string | undefined
): Promise<SendTimesheetEmailResult> {
  const { data: timesheet } = await supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(
            first_name,
            last_name,
            email,
            billing_email,
            payment_method,
            cash_deduction,
            hst_gst
          ),
          positions!inner(
            title,
            client_name,
            city,
            province,
            premium_pay_rate
          )
        `
    )
    .eq("id", id)
    .maybeSingle();

  if (!timesheet) {
    return {
      success: false,
      status: 404,
      body: { error: "Timesheet not found" },
    };
  }

  const jobseekerProfile = timesheet.jobseeker_profiles;
  const position = timesheet.positions;
  const premiumPayRate = effectivePremiumPayRate(
    timesheet.premium_pay_rate,
    position?.premium_pay_rate
  );

  if (!jobseekerProfile?.email) {
    return {
      success: false,
      status: 400,
      body: { error: "Jobseeker email not found" },
    };
  }

  const emailTo = jobseekerProfile.billing_email || jobseekerProfile.email;

  if (userType === "jobseeker" && userId !== timesheet.jobseeker_user_id) {
    return {
      success: false,
      status: 403,
      body: {
        error:
          "Access denied: You can only send emails for your own timesheets",
      },
    };
  }

  const templateVars = {
    invoice_number: timesheet.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    jobseeker_email: emailTo,
    position_title: position?.title || "Unknown Position",
    week_start_date: timesheet.week_start_date,
    week_end_date: timesheet.week_end_date,
    daily_hours: timesheet.daily_hours || [],
    total_regular_hours: timesheet.total_regular_hours,
    total_overtime_hours: timesheet.total_overtime_hours,
    regular_pay_rate: timesheet.regular_pay_rate,
    premium_pay_rate: premiumPayRate,
    overtime_pay_rate: timesheet.overtime_pay_rate,
    total_jobseeker_pay: timesheet.total_jobseeker_pay,
    overtime_enabled:
      timesheet.overtime_enabled || timesheet.total_overtime_hours > 0,
    bonus_amount: timesheet.bonus_amount,
    deduction_amount: timesheet.deduction_amount,
    tax_amount: timesheet.tax_amount,
    ...emailCashDeductionVars({
      linePaymentMethod: timesheet.line_payment_method,
      profilePaymentMethod: jobseekerProfile.payment_method,
      cashDeductionStr: jobseekerProfile.cash_deduction,
      totalRegularHours: toNum(timesheet.total_regular_hours),
      regularPayRate: toNum(timesheet.regular_pay_rate),
      premiumPayRate,
      totalOvertimeHours: toNum(timesheet.total_overtime_hours),
      overtimePayRate: toNum(timesheet.overtime_pay_rate),
    }),
    generated_date: new Date().toLocaleDateString(),
  };

  console.log(
    "Sending timesheet email to the",
    jobseekerProfile.billing_email ? "billing email" : "primary email"
  );

  const html = timesheetHtmlTemplate(templateVars);
  const text = timesheetTextTemplate(templateVars);
  const [subjectLine, ...bodyLines] = text.split("\n");
  const subject = subjectLine.replace("Subject:", "").trim();

  let emailSent = false;
  let errorMsg = "";

  try {
    await sgMail.send({
      to: emailTo,
      from: getNoReplyFromEmail(),
      subject,
      text: bodyLines.join("\n").trim(),
      html,
    });
    emailSent = true;
  } catch (err) {
    if (err instanceof Error) {
      errorMsg = err.message;
    } else if (typeof err === "string") {
      errorMsg = err;
    } else {
      errorMsg = JSON.stringify(err);
    }
  }

  if (emailSent) {
    await supabase.from("timesheets").update({ email_sent: true }).eq("id", id);
  }

  const timesheetSendResult = {
    invoice_number: timesheet.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    email_sent: emailSent,
    error: errorMsg,
  };

  if (emailSent) {
    return {
      success: true,
      status: 200,
      body: {
        success: true,
        message: `Email sent successfully to ${emailTo}`,
        email_sent: true,
      },
      timesheetSendResult,
    };
  }

  return {
    success: false,
    status: 500,
    body: {
      success: false,
      message: `Failed to send email: ${errorMsg}`,
      email_sent: false,
      error: errorMsg,
    },
    timesheetSendResult,
  };
}
