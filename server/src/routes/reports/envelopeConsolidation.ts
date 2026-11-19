const CONSOLIDATED_PAY_CYCLES = [
  "1 Week Hold - Biweekly Pay",
  "2 Week Hold - Biweekly Pay",
];

/**
 * For "1 Week Hold - Biweekly Pay" and "2 Week Hold - Biweekly Pay" clients, the selected
 * weeks are paid together, so collapse every row of a jobseeker (per client) into ONE row:
 * hours/amounts/tax are summed; pay methods, positions and rates are listed once each.
 * All other pay cycles are returned untouched.
 */
export function consolidateBiweeklyEnvelopeRows(items: any[]): any[] {
  const round2 = (n: number) =>
    (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
  const trimNum = (n: number) =>
    String(Math.round((n + Number.EPSILON) * 100) / 100);
  const uniqJoin = (values: unknown[], splitCommas = false): string => {
    const out: string[] = [];
    for (const v of values) {
      const parts = splitCommas
        ? String(v ?? "").split(",")
        : [String(v ?? "")];
      for (const part of parts) {
        const t = part.trim();
        if (t && !out.includes(t)) out.push(t);
      }
    }
    return out.join(", ");
  };

  const result: any[] = [];
  const groups = new Map<string, any[]>();

  for (const item of items) {
    if (!CONSOLIDATED_PAY_CYCLES.includes(item.pay_cycle)) {
      result.push(item);
      continue;
    }
    const key = `${item.client_name}|${item.jobseeker_id}`;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      const created = [item];
      groups.set(key, created);
      // placeholder keeps the original ordering of the report
      result.push(created);
    }
  }

  return result.map((entry) => {
    if (!Array.isArray(entry)) return entry;
    const rows: any[] = entry;
    if (rows.length === 1) return rows[0];

    const sum = (field: string) =>
      rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
    const lineAmount = sum("line_amount");
    const hstGst = sum("hst_gst");
    const latest = (field: string) =>
      rows
        .map((r) => String(r[field] || ""))
        .filter(Boolean)
        .sort()
        .pop() || "";

    return {
      ...rows[0],
      week_ending: latest("week_ending"),
      payment_due_date: latest("payment_due_date"),
      invoice_date: latest("invoice_date"),
      invoice_number: uniqJoin(rows.map((r) => r.invoice_number)),
      pay_method: uniqJoin(rows.map((r) => r.pay_method)),
      position_category: uniqJoin(
        rows.map((r) => r.position_category),
        true
      ),
      position_name: uniqJoin(rows.map((r) => r.position_name)),
      hours: trimNum(sum("hours")),
      overtime_hours: trimNum(sum("overtime_hours")),
      regular_pay_rate: uniqJoin(
        rows.map((r) => r.regular_pay_rate),
        true
      ),
      premium_pay_rate: uniqJoin(
        rows.map((r) => r.premium_pay_rate),
        true
      ),
      overtime_pay_rate: uniqJoin(
        rows.map((r) => r.overtime_pay_rate),
        true
      ),
      total_amount: round2(sum("total_amount")),
      hst_gst: round2(hstGst),
      line_amount: round2(lineAmount),
      tax_rate:
        lineAmount > 0 && hstGst > 0
          ? ((hstGst / lineAmount) * 100).toFixed(2)
          : "0.00",
    };
  });
}
