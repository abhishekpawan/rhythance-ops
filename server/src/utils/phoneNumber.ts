/** E.164 form with a leading '+', for external services (Twilio) and metadata. Spaces are removed. */
export const normalizeToE164 = (phone?: string) => {
  if (!phone) return phone;
  const trimmed = String(phone).replace(/\s+/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
};

/** The digits only: the same number written with dashes, brackets or spaces counts as one. */
export const phoneDigits = (phone: unknown): string =>
  typeof phone === "string" ? phone.replace(/\D+/g, "") : "";
