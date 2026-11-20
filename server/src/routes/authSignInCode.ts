import express from "express";
import { createSignInClient } from "../utils/signInClient.js";
import { isRecruiterEmail } from "../utils/recruiterEmail.js";
import {
  signInCodeAddressLimiter,
  takeAccountSend,
} from "../middleware/otpRateLimits.js";
import {
  isStaffUser,
  sendPhoneCode,
  twoFactorEnforced,
  twoFactorPhone,
} from "../services/staffTwoFactor.js";
import { EMAIL_AND_PASSWORD_REQUIRED, signInFailure } from "./authSignIn.js";

// The sign-in phone code of the two-step login. Unlike the public `send-verification` (sign-up has no account
// yet), this one first checks the email and password and texts only the number on file, so a number alone is
// not enough to trigger or use up someone's sign-in codes. Limits: middleware/otpRateLimits.ts.
const router = express.Router();

router.post(
  "/send-sign-in-code",
  signInCodeAddressLimiter,
  async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json(EMAIL_AND_PASSWORD_REQUIRED);
      }

      const signInClient = createSignInClient();
      const { data, error } = await signInClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return res.status(401).json(signInFailure(error));
      // The check only needed to know the password is right: no session is kept
      // End just this throwaway session. The default scope signs the account out everywhere, including a
      // sign-in that finished a moment ago.
      await signInClient.auth.signOut({ scope: "local" });

      // Staff by their trusted role. While the server does not enforce the code (the demo databases) the login
      // screen still asks every staff account for one, so an address the portal settings list as staff counts too.
      // A jobseeker never gets a code from here.
      const needsCode =
        isStaffUser(data.user) ||
        (!(await twoFactorEnforced()) && isRecruiterEmail(email));
      if (!needsCode) {
        return res.status(400).json({
          error: "This account does not use a sign-in code",
          code: "TWO_FACTOR_NOT_REQUIRED",
        });
      }

      const phone = twoFactorPhone(data.user);
      if (!phone) {
        return res.status(400).json({
          error: "No phone number on file for two-step login",
          code: "NO_2FA_PHONE",
        });
      }

      if (!takeAccountSend(data.user.id)) {
        return res.status(429).json({
          error: "Too many requests, please try again later.",
          code: "RATE_LIMITED",
        });
      }

      const sent = await sendPhoneCode(phone);
      if (sent === "unavailable") {
        return res.status(500).json({
          error: "Phone verification service is not available",
          code: "PHONE_SERVICE_UNAVAILABLE",
        });
      }
      if (sent === "failed") {
        return res.status(400).json({
          error: "Failed to send verification code",
          code: "SEND_CODE_FAILED",
        });
      }
      return res.status(200).json({ message: "Verification code sent" });
    } catch (error) {
      console.error("Send sign-in code error:", error);
      return res.status(500).json({
        error: "Failed to send verification code",
        code: "SEND_CODE_FAILED",
      });
    }
  }
);

export default router;
