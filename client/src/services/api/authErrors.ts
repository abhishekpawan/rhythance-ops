import axios from "axios";

/**
 * Sign-in and phone-code errors. The server sends an English `error` text and a stable `code`
 * (server/src/routes/authSignIn.ts, authSignInCode.ts, authPhone.ts, middleware/otpRateLimits.ts). Screens show the translation
 * of the code (`auth.errors.<CODE>`, in English and French) and fall back to the server text for a code
 * they do not know.
 */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "TOO_MANY_ATTEMPTS",
  "ACCOUNT_DISABLED",
  "SIGN_IN_FAILED",
  "EMAIL_AND_PASSWORD_REQUIRED",
  "TWO_FACTOR_REQUIRED",
  "TWO_FACTOR_CODE_REQUIRED",
  "TWO_FACTOR_NOT_REQUIRED",
  "NO_2FA_PHONE",
  "INVALID_2FA_CODE",
  "TWO_FACTOR_FAILED",
  "RATE_LIMITED",
  "PHONE_REQUIRED",
  "PHONE_AND_CODE_REQUIRED",
  "PHONE_SERVICE_UNAVAILABLE",
  "SEND_CODE_FAILED",
  "INVALID_CODE",
  "CHECK_CODE_FAILED",
  "NOT_YOUR_ACCOUNT",
] as const;

export class AuthApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/** An error from one of the auth calls, with the server's `code` and status kept. Other errors pass through. */
export function toAuthApiError(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as
      { error?: string; code?: string } | undefined;
    return new AuthApiError(
      data?.error || fallbackMessage,
      data?.code,
      error.response.status
    );
  }
  return error;
}

/** The message to show for an error from an auth call, in the language of `t`. */
export function authErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey: string
): string {
  if (error instanceof AuthApiError && error.code) {
    if ((AUTH_ERROR_CODES as readonly string[]).includes(error.code)) {
      return t(`auth.errors.${error.code}`);
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}
