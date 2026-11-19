import { checkJobseekerInactive } from "./clientActivity.js";

function toNumReport(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Cash / e-Transfer % deduction on base pay; aligns with timesheet email logic (line_payment_method for split rows). */
function computeTimesheetCashDeductionAmount(
  row: {
    total_regular_hours?: unknown;
    total_overtime_hours?: unknown;
    regular_pay_rate?: unknown;
    premium_pay_rate?: unknown;
    overtime_pay_rate?: unknown;
    line_payment_method?: string | null;
  },
  jp: { payment_method?: string | null; cash_deduction?: string | null }
): string {
  const pct = parseFloat(String(jp.cash_deduction ?? "0")) || 0;
  const linePm = row.line_payment_method;
  const profilePm = jp.payment_method;
  const effectivePm =
    linePm && String(linePm).trim() !== ""
      ? String(linePm)
      : String(profilePm ?? "");
  const applies = effectivePm === "Cash" || effectivePm === "e-Transfer";
  if (!applies || pct <= 0) return "0.00";
  const basePay =
    toNumReport(row.total_regular_hours) *
      (toNumReport(row.regular_pay_rate) + toNumReport(row.premium_pay_rate)) +
    toNumReport(row.total_overtime_hours) * toNumReport(row.overtime_pay_rate);
  return (basePay * (pct / 100)).toFixed(2);
}

export function mapTimesheetReportRows(
  filtered: any[],
  positionIds: string[],
  positionsMap: Record<string, any>
) {
  return filtered.map((row: any) => {
    const jp = row.jobseeker_profiles || {};
    const p = row.positions || {};

    // For bulk timesheets, resolve position info and rates from the breakdown.
    // Always show real position names (comma-separated if multiple).
    let resolvedTitle = p.title;
    let resolvedCode = p.position_code;
    let resolvedCategory = p.position_category;
    let resolvedClientManager = p.client_manager;
    let resolvedNotes = p.notes;
    let resolvedPayRate = row.regular_pay_rate;
    let resolvedPremiumRate = row.premium_pay_rate;
    let resolvedOvertimeRate = row.overtime_pay_rate;
    let resolvedClientId = p.client;

    if (
      row.is_bulk &&
      Array.isArray(row.bulk_breakdown) &&
      row.bulk_breakdown.length > 0
    ) {
      // Find breakdown entries belonging to the selected client's positions
      const matchingBreakdowns =
        positionIds.length > 0
          ? row.bulk_breakdown.filter((bd: any) =>
              positionIds.includes(bd.position_id)
            )
          : row.bulk_breakdown;

      if (matchingBreakdowns.length > 0) {
        // Build comma-separated position names/codes from the real positions map,
        // falling back to the title/code stored in bulk_breakdown itself.
        const titles: string[] = [];
        const codes: string[] = [];
        const categories: string[] = [];

        for (const bd of matchingBreakdowns) {
          const posFromMap = positionsMap[bd.position_id];
          titles.push(posFromMap?.title || bd.position_title || "");
          codes.push(posFromMap?.position_code || bd.position_code || "");
          categories.push(posFromMap?.position_category || "");
        }

        resolvedTitle = [...new Set(titles.filter(Boolean))].join(", ");
        resolvedCode = [...new Set(codes.filter(Boolean))].join(", ");
        resolvedCategory = [...new Set(categories.filter(Boolean))].join(", ");

        // Use the first matching breakdown's rates (most relevant for the selected client)
        const firstBd = matchingBreakdowns[0];
        const firstPosFromMap = positionsMap[firstBd.position_id];
        resolvedPayRate = firstBd.regular_pay_rate ?? 0;
        resolvedPremiumRate =
          firstBd.premium_pay_rate ?? row.premium_pay_rate ?? 0;
        resolvedOvertimeRate =
          firstBd.overtime_pay_rate ?? row.overtime_pay_rate ?? 0;
        resolvedClientManager =
          firstPosFromMap?.client_manager || p.client_manager;
        resolvedNotes = firstPosFromMap?.notes || p.notes;
        resolvedClientId = firstPosFromMap?.client || p.client;
      }
    }

    return {
      employee_id: jp.employee_id,
      license_number: jp.license_number,
      passport_number: jp.passport_number,
      name: (jp.first_name || "") + " " + (jp.last_name || ""),
      mobile: jp.mobile,
      email: jp.email,
      company_name: undefined, // will fill below
      list_name: undefined, // will fill below
      title: resolvedTitle,
      position_code: resolvedCode,
      position_category: resolvedCategory,
      client_manager: resolvedClientManager,

      week_start_date: row.week_start_date,
      week_end_date: row.week_end_date,
      total_regular_hours: row.total_regular_hours,
      total_overtime_hours: row.total_overtime_hours,
      regular_pay_rate: resolvedPayRate,
      premium_pay_rate: resolvedPremiumRate,
      overtime_pay_rate: resolvedOvertimeRate,
      total_jobseeker_pay: row.total_jobseeker_pay,
      bonus_amount: row.bonus_amount,
      deduction_amount: row.deduction_amount,
      cash_deduction_amount: computeTimesheetCashDeductionAmount(
        {
          ...row,
          regular_pay_rate: resolvedPayRate,
          premium_pay_rate: resolvedPremiumRate,
          overtime_pay_rate: resolvedOvertimeRate,
        },
        jp
      ),
      hst_gst: jp.hst_gst,
      currency: undefined, // will fill below
      payment_method:
        row.line_payment_method && String(row.line_payment_method).trim() !== ""
          ? row.line_payment_method
          : jp.payment_method,
      pay_cycle: undefined, // will fill below
      notes: resolvedNotes,
      timesheet_created_at: row.created_at,
      invoice_number: row.invoice_number,
      client_id: resolvedClientId, // <-- resolved client_id for lookup below
      jobseeker_is_inactive: checkJobseekerInactive(
        jp.last_activity_at,
        jp.created_at
      ),
    };
  });
}
