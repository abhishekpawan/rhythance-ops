export type EnvelopeInvoiceLookup = {
  invoice_number: string;
  invoice_date: string;
};

function invoiceLineMatchesJobseekerPosition(
  line: {
    jobseekerProfile?: { jobseekerProfileId?: string };
    jobseekerProfileId?: string;
    position?: { positionId?: string };
    positionId?: string;
    weekStartDate?: string;
    week_start_date?: string;
    weekEndDate?: string;
    week_end_date?: string;
  },
  jobseekerProfileId: string,
  positionId: string,
  weekStartDate?: string,
  weekEndDate?: string
): boolean {
  const lineProfileId =
    line.jobseekerProfile?.jobseekerProfileId ?? line.jobseekerProfileId;
  const linePositionId = line.position?.positionId ?? line.positionId;

  if (lineProfileId !== jobseekerProfileId || linePositionId !== positionId) {
    return false;
  }

  const lineWeekStart = line.weekStartDate || line.week_start_date;
  const lineWeekEnd = line.weekEndDate || line.week_end_date;

  if (weekStartDate && lineWeekStart && weekStartDate !== lineWeekStart) {
    return false;
  }
  if (weekEndDate && lineWeekEnd && weekEndDate !== lineWeekEnd) {
    return false;
  }

  return true;
}

export function resolveEnvelopeInvoice(
  jobseekerProfileId: string,
  positionId: string,
  invoices: Array<{
    invoice_number?: string;
    invoice_date?: string;
    invoice_data?: { timesheets?: unknown[] };
  }>,
  weekStartDate?: string,
  weekEndDate?: string
): EnvelopeInvoiceLookup | null {
  let best: EnvelopeInvoiceLookup | null = null;
  let bestDate = "";

  for (const invoice of invoices) {
    const lines = (invoice.invoice_data?.timesheets || []) as Array<{
      jobseekerProfile?: { jobseekerProfileId?: string };
      jobseekerProfileId?: string;
      position?: { positionId?: string };
      positionId?: string;
      weekStartDate?: string;
      week_start_date?: string;
      weekEndDate?: string;
      week_end_date?: string;
    }>;

    const hasLine = lines.some((line) =>
      invoiceLineMatchesJobseekerPosition(
        line,
        jobseekerProfileId,
        positionId,
        weekStartDate,
        weekEndDate
      )
    );

    if (!hasLine) continue;

    const invoiceDate = invoice.invoice_date || "";
    if (!best || invoiceDate > bestDate) {
      best = {
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoiceDate,
      };
      bestDate = invoiceDate;
    }
  }

  return best;
}
