function formatWeekEndingForSrNo(dateValue: string | null | undefined): string {
  if (!dateValue) return "00000000";

  const digitsOnly = dateValue.replace(/\D/g, "");
  if (digitsOnly.length >= 8) {
    return digitsOnly.slice(0, 8);
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "00000000";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildEnvelopeSrNo(
  shortCode: string | null | undefined,
  weekEnding: string | null | undefined,
  sequenceNumber: number
): string {
  const normalizedShortCode = (shortCode || "NA").trim() || "NA";
  const weekEndingToken = formatWeekEndingForSrNo(weekEnding);
  const sequenceToken = String(sequenceNumber).padStart(3, "0");
  return `${normalizedShortCode}-${weekEndingToken}-${sequenceToken}`;
}
