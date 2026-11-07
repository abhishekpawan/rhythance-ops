/**
 * Counts SIN and work permit expiry dates by urgency: expired, within 30, 60
 * or 90 days, later, or missing. Used by GET /api/metrics/jobseekers/expiry-status-counts.
 */

export interface ExpiryProfile {
  sin_expiry: string | null;
  work_permit_expiry: string | null;
}

export function countExpiryStatuses(
  profiles: ExpiryProfile[],
  now: Date = new Date()
) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Calculate date thresholds
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const in60Days = new Date(today);
  in60Days.setDate(in60Days.getDate() + 60);

  const in90Days = new Date(today);
  in90Days.setDate(in90Days.getDate() + 90);

  const emptyCounts = () => ({
    expired: 0,
    expiringUnder30: 0,
    expiringUnder60: 0,
    expiringUnder90: 0,
    expiringAfter90: 0,
    noData: 0,
  });
  const sinCounts = emptyCounts();
  const workPermitCounts = emptyCounts();
  type Category = keyof ReturnType<typeof emptyCounts>;

  const categorizeExpiryDate = (expiryDate: string | null): Category => {
    if (!expiryDate) return "noData";

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    if (expiry < today) return "expired";
    if (expiry <= in30Days) return "expiringUnder30";
    if (expiry <= in60Days) return "expiringUnder60";
    if (expiry <= in90Days) return "expiringUnder90";
    return "expiringAfter90";
  };

  profiles.forEach((profile) => {
    sinCounts[categorizeExpiryDate(profile.sin_expiry)]++;
    workPermitCounts[categorizeExpiryDate(profile.work_permit_expiry)]++;
  });

  const withData = (c: ReturnType<typeof emptyCounts>) =>
    c.expired +
    c.expiringUnder30 +
    c.expiringUnder60 +
    c.expiringUnder90 +
    c.expiringAfter90;

  return {
    totalProfiles: profiles.length,
    sin: { ...sinCounts, totalWithData: withData(sinCounts) },
    workPermit: {
      ...workPermitCounts,
      totalWithData: withData(workPermitCounts),
    },
    summary: {
      criticalCount: sinCounts.expired + workPermitCounts.expired,
      urgentCount: sinCounts.expiringUnder30 + workPermitCounts.expiringUnder30,
      warningCount:
        sinCounts.expiringUnder60 + workPermitCounts.expiringUnder60,
      cautionCount:
        sinCounts.expiringUnder90 + workPermitCounts.expiringUnder90,
    },
  };
}
