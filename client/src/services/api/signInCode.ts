import { api } from "./index";
import { toAuthApiError } from "./authErrors";

/**
 * Text the sign-in phone code of the two-step login. The server checks the email and password first and texts
 * only the number it has on file; the browser never names a number (server/src/routes/authSignInCode.ts).
 */
export const sendSignInCodeAPI = async (email: string, password: string) => {
  try {
    const response = await api.post("/api/auth/send-sign-in-code", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw toAuthApiError(error, "Failed to send verification code");
  }
};
