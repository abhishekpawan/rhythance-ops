// The "Sub Total" cell of the weekly timesheet report: worked out in the browser from the hours and
// pay rates the server sends (moved verbatim from WeeklyTimesheet.tsx).
export const weeklyTimesheetSubTotal = (
  row?: Record<string, unknown>
): string => {
  const regHrs = Number((row as any)?.total_regular_hours || 0);
  const regPay = Number((row as any)?.regular_pay_rate || 0);
  const otHrs = Number((row as any)?.total_overtime_hours || 0);
  const otPay = Number((row as any)?.overtime_pay_rate || 0);
  const sub = regHrs * regPay + otHrs * otPay;
  return `$${sub.toFixed(2)}`;
};
