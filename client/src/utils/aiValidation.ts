import type {
  AIValidationChecked,
  AIValidationNotChecked,
  AIValidationResponse,
  DocumentRecord,
} from "../types/jobseeker";

/** The AI service could not check the document: no score and no flags exist, only a reason. */
export const isNotChecked = (
  validation: AIValidationResponse | null | undefined
): validation is AIValidationNotChecked =>
  validation?.check_status === "not_checked";

/** The reasons the AI service gives (`NOT_CHECKED_REASONS` in godspeed-ops-ai); each has a message in en and fr. */
export const NOT_CHECKED_REASONS = [
  "download_failed",
  "file_too_large",
  "vendor_quota",
  "vendor_auth",
  "model_unavailable",
  "vendor_unavailable",
  "model_error",
  "internal_error",
] as const;

/** Translation key of the message for a not-checked reason (an unknown or missing reason gets the general one). */
export const notCheckedReasonKey = (reason?: string): string =>
  (NOT_CHECKED_REASONS as readonly string[]).includes(reason ?? "")
    ? `jobSeekerProfile.notCheckedReason.${reason}`
    : "jobSeekerProfile.notCheckedReason.unknown";

/** A document whose check ran and found something a staff member should look at. A not-checked document has no flags. */
export const documentNeedsAttention = (
  doc: Pick<DocumentRecord, "aiValidation">
): boolean => {
  const v = doc.aiValidation;
  if (!v || isNotChecked(v)) return false;
  const checked: AIValidationChecked = v;
  return (
    checked.is_tampered === true ||
    checked.is_blurry === true ||
    checked.is_text_clear === false ||
    checked.is_resubmission_required === true
  );
};

export const scoreColorClass = (percentage: number): string => {
  if (percentage >= 80) return "success";
  if (percentage >= 40) return "pending";
  return "failure";
};
