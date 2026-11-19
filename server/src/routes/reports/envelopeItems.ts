import {
  checkClientInactive,
  checkJobseekerInactive,
} from "./clientActivity.js";

/** Helper to build envelope report items for a single timesheet row, handling hybrid payment splits dynamically. */
export function buildEnvelopeItemsForRow(
  row: any,
  jp: any,
  client: any,
  position: any,
  positionIds: string[],
  positionsMap: Record<string, any>,
  matchedInvoice: any,
  paymentDueDate: string | null
): any[] {
  const round2 = (num: number) =>
    (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const isInactiveClient = checkClientInactive(
    client.last_activity_at,
    client.created_at
  );
  const isInactiveJp = checkJobseekerInactive(
    jp.last_activity_at,
    jp.created_at
  );

  const baseItemData = {
    city: client.city1 || "",
    list_name: client.list_name || "",
    week_ending: row.week_end_date || "",
    client_name: client.company_name || "",
    sales_person: client.sales_person || "",
    short_code: client.short_code || "",
    work_province: client.province1 || "",
    pay_cycle: client.pay_cycle || "",
    jobseeker_id: jp.employee_id || "",
    license_number: jp.license_number || "",
    passport_number: jp.passport_number || "",
    jobseeker_name: `${jp.first_name || ""} ${jp.last_name || ""}`.trim(),
    phone_number: jp.mobile || "",
    email_id: jp.email || "",
    billing_email:
      jp.billing_email && String(jp.billing_email).trim() !== ""
        ? String(jp.billing_email).trim()
        : jp.email || "",
    currency: client.currency || "",
    invoice_number: matchedInvoice?.invoice_number ?? "",
    invoice_date: matchedInvoice?.invoice_date ?? "",
    payment_due_date: paymentDueDate ?? "",
    client_is_inactive: isInactiveClient,
    jobseeker_is_inactive: isInactiveJp,
  };

  // Resolve position name, category, and rates from bulk_breakdown if is_bulk.
  // Rates are display strings: for multi-position (bulk) rows every position's rate is
  // listed (comma-separated, aligned with the position names) instead of only the first.
  let resolvedPositionName = position.title
    ? `${position.title} [${position.position_number || ""}]`
    : "";
  let resolvedPositionCategory = position.position_category || "";
  let resolvedPayRate = (Number(row.regular_pay_rate) || 0).toFixed(2);
  let resolvedPremiumRate = (Number(row.premium_pay_rate) || 0).toFixed(2);
  let resolvedOvertimeRate = (Number(row.overtime_pay_rate) || 0).toFixed(2);
  // Numeric rate used for calculations (hours-weighted across positions for bulk rows)
  let calcPayRate = Number(row.regular_pay_rate) || 0;
  // Base regular pay for bulk rows = sum of (hours x rate) over every position
  let bulkRegularBase: number | null = null;

  if (
    row.is_bulk &&
    Array.isArray(row.bulk_breakdown) &&
    row.bulk_breakdown.length > 0
  ) {
    const allBreakdowns: any[] = row.bulk_breakdown;
    bulkRegularBase = allBreakdowns.reduce(
      (sum: number, bd: any) =>
        sum +
        (Number(bd.regular_hours) || 0) * (Number(bd.regular_pay_rate) || 0),
      0
    );
    const bulkRegularHours = allBreakdowns.reduce(
      (sum: number, bd: any) => sum + (Number(bd.regular_hours) || 0),
      0
    );
    if (bulkRegularHours > 0) {
      calcPayRate = (bulkRegularBase ?? 0) / bulkRegularHours;
    }

    const matchingBreakdowns =
      positionIds.length > 0
        ? allBreakdowns.filter((bd: any) =>
            positionIds.includes(bd.position_id)
          )
        : allBreakdowns;

    if (matchingBreakdowns.length > 0) {
      const names: string[] = [];
      const categories: string[] = [];
      const payRates: string[] = [];
      const premiumRates: string[] = [];
      const overtimeRates: string[] = [];
      const seen = new Set<string>();
      for (const bd of matchingBreakdowns) {
        const posFromMap = positionsMap[bd.position_id];
        const title = posFromMap?.title || bd.position_title || "";
        const num = posFromMap?.position_number || "";
        const label = title ? (num ? `${title} [${num}]` : title) : "";
        const payR = (Number(bd.regular_pay_rate) || 0).toFixed(2);
        // Breakdowns only store premium/OT rates in some cases; otherwise the
        // timesheet-level value applies to the whole row and is shown once.
        const premR = (Number(bd.premium_pay_rate) || 0).toFixed(2);
        const otR = (Number(bd.overtime_pay_rate) || 0).toFixed(2);
        const key = `${label}|${payR}|${premR}|${otR}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (label) names.push(label);
        if (posFromMap?.position_category)
          categories.push(posFromMap.position_category);
        payRates.push(payR);
        premiumRates.push(premR);
        overtimeRates.push(otR);
      }
      resolvedPositionName = [...new Set(names)].join(", ");
      resolvedPositionCategory = [...new Set(categories)].join(", ");
      resolvedPayRate = payRates.join(", ");
      if (matchingBreakdowns.some((bd: any) => bd.premium_pay_rate != null)) {
        resolvedPremiumRate = premiumRates.join(", ");
      }
      if (matchingBreakdowns.some((bd: any) => bd.overtime_pay_rate != null)) {
        resolvedOvertimeRate = overtimeRates.join(", ");
      }
    }
  }

  const profilePm = String(jp.payment_method || "").trim();
  const linePmRaw = row.line_payment_method
    ? String(row.line_payment_method).trim()
    : "";
  const segment = row.pay_split_segment
    ? String(row.pay_split_segment).trim()
    : "single";

  const isHybridProfile =
    profilePm === "SIN and cash" || profilePm === "SIN and e-Transfer";

  // Check if row is already split in DB
  const isAlreadySplit =
    segment !== "single" ||
    (linePmRaw !== "" &&
      linePmRaw !== "SIN and cash" &&
      linePmRaw !== "SIN and e-Transfer");

  if (isAlreadySplit || !isHybridProfile) {
    let effectivePm = linePmRaw !== "" ? linePmRaw : profilePm;
    if (effectivePm === "SIN-Direct Deposit") {
      effectivePm = "SIN";
    }

    let lineAmount = Number(row.total_jobseeker_pay) || 0;
    let finalTotalAmount = lineAmount;
    let taxAmt = Number(row.tax_amount) || 0;
    let taxRate = 0;

    if (effectivePm.includes("Corporation")) {
      const regH = Number(row.total_regular_hours) || 0;
      const otH = Number(row.total_overtime_hours) || 0;
      const otR = Number(row.overtime_pay_rate) || 0;
      const bonusA = Number(row.bonus_amount) || 0;
      const dedA = Number(row.deduction_amount) || 0;
      const regBase = bulkRegularBase ?? regH * calcPayRate;

      // Subtotal before tax
      lineAmount = Math.max(0, regBase + otH * otR + bonusA - dedA);

      if (typeof jp.hst_gst === "string" || typeof jp.hst_gst === "number") {
        const match = String(jp.hst_gst || "").match(/^([\d.]+)\s*%?$/);
        if (match && match[1]) {
          taxRate = parseFloat(match[1]) || 0;
        }
      }

      if (taxRate > 0) {
        taxAmt = lineAmount * (taxRate / 100);
      } else if (taxAmt > 0 && lineAmount > 0) {
        taxRate = (taxAmt / lineAmount) * 100;
      }

      finalTotalAmount = lineAmount + taxAmt;
    } else {
      lineAmount = Math.max(0, finalTotalAmount - taxAmt);
    }

    return [
      {
        ...baseItemData,
        pay_method: effectivePm,
        position_category: resolvedPositionCategory,
        position_name: resolvedPositionName,
        hours: (Number(row.total_regular_hours) || 0).toString(),
        overtime_hours: (Number(row.total_overtime_hours) || 0).toString(),
        regular_pay_rate: resolvedPayRate,
        premium_pay_rate: resolvedPremiumRate,
        overtime_pay_rate: resolvedOvertimeRate,
        total_amount: round2(finalTotalAmount),
        tax_rate: taxRate.toFixed(2),
        hst_gst: round2(taxAmt),
        line_amount: round2(lineAmount),
      },
    ];
  }

  // Unsplit row for a Jobseeker with a Hybrid Payment Method ("SIN and cash" or "SIN and e-Transfer")
  const items: any[] = [];
  const rawSinCap = parseFloat(String(jp.sin_payroll_hours_cap ?? "0"));
  const sinCap = Number.isFinite(rawSinCap) && rawSinCap >= 0 ? rawSinCap : 0;

  const totalRegHours = Number(row.total_regular_hours) || 0;
  const totalOtHours = Number(row.total_overtime_hours) || 0;
  const regPayRateNum = calcPayRate;
  const otPayRateNum = Number(row.overtime_pay_rate) || 0;

  const sinRegular = Math.min(sinCap, totalRegHours);
  const cashRegular = Math.max(0, totalRegHours - sinRegular);
  const cashOvertime = totalOtHours;
  const sinOvertime = 0;

  const secondaryMethod = profilePm === "SIN and cash" ? "Cash" : "e-Transfer";
  const bonusAmt = Number(row.bonus_amount) || 0;
  const dedAmt = Number(row.deduction_amount) || 0;

  // SIN portion
  if (sinRegular > 0 || (totalRegHours === 0 && totalOtHours === 0)) {
    const sinPay = sinRegular * regPayRateNum + bonusAmt - dedAmt;
    items.push({
      ...baseItemData,
      pay_method: "SIN",
      position_category: resolvedPositionCategory,
      position_name: resolvedPositionName,
      hours: sinRegular.toString(),
      overtime_hours: sinOvertime.toString(),
      regular_pay_rate: resolvedPayRate,
      premium_pay_rate: resolvedPremiumRate,
      overtime_pay_rate: resolvedOvertimeRate,
      total_amount: round2(sinPay),
      tax_rate: "0.00",
      hst_gst: "0.00",
      line_amount: round2(sinPay),
    });
  }

  // Secondary portion (Cash / e-Transfer)
  const cashTotalHours = cashRegular + cashOvertime;
  if (cashTotalHours > 0) {
    const baseCashPay =
      cashRegular * regPayRateNum + cashOvertime * otPayRateNum;
    const cashDeductionPct = parseFloat(String(jp.cash_deduction || "0"));
    let cashDeductionAmt = 0;
    if (
      Number.isFinite(cashDeductionPct) &&
      cashDeductionPct > 0 &&
      baseCashPay > 0
    ) {
      cashDeductionAmt = baseCashPay * (cashDeductionPct / 100);
    }
    const cashPay = Math.max(0, baseCashPay - cashDeductionAmt);

    items.push({
      ...baseItemData,
      pay_method: secondaryMethod,
      position_category: resolvedPositionCategory,
      position_name: resolvedPositionName,
      hours: cashRegular.toString(),
      overtime_hours: cashOvertime.toString(),
      regular_pay_rate: resolvedPayRate,
      premium_pay_rate: resolvedPremiumRate,
      overtime_pay_rate: resolvedOvertimeRate,
      total_amount: round2(cashPay),
      tax_rate: "0.00",
      hst_gst: "0.00",
      line_amount: round2(cashPay),
    });
  }

  return items;
}
