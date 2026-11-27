import type { PositionData } from "../../services/api/position";

// The two rate rules the invoice page wrote three times (the totals, the create body and the update body); one copy
// each since R-5b. Each caller still decides its own inputs (the hours split, where the premium comes from).

/** The bill rate of overtime hours: the position's own when overtime is on and it has one, else the regular rate. */
export const overtimeBillRateOf = (
  position: PositionData | null | undefined,
  regularBillRate: number
): number =>
  position?.overtimeEnabled && position?.overtimeBillRate
    ? parseFloat(position.overtimeBillRate)
    : regularBillRate;

/**
 * What the jobseeker is paid for a line: the regular pay rate plus the premium, and for overtime hours the position's
 * overtime pay rate when overtime is on and it has one (else the same rate as regular hours).
 */
export const jobseekerPayOf = (
  position: PositionData | null | undefined,
  regularHours: number,
  overtimeHours: number,
  regularPayRate: number,
  premiumPayRate: number
) => {
  const effectivePayRate = regularPayRate + premiumPayRate;
  const overtimePayRate =
    position?.overtimeEnabled && position?.overtimePayRate
      ? parseFloat(position.overtimePayRate)
      : effectivePayRate;
  const totalJobseekerPay =
    regularHours * effectivePayRate + overtimeHours * overtimePayRate;
  return { overtimePayRate, totalJobseekerPay };
};
