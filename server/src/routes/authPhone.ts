import express, { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import twilio from "twilio";
import { authenticateToken } from "../middleware/auth.js";
import {
  checkCodeLimiters,
  sendCodeLimiters,
} from "../middleware/otpRateLimits.js";
import { normalizeToE164 } from "../utils/phoneNumber.js";

dotenv.config();

// Phone-code routes of /api/auth (moved out of auth.ts). Both are public (sign-up has no session yet) and
// text real numbers, so both sit behind the limits in middleware/otpRateLimits.ts.
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY) as string
);
const router = express.Router();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
const isTwilioConfigured = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_VERIFY_SERVICE_SID
);

const SERVICE_UNAVAILABLE = {
  error: "Phone verification service is not available",
  code: "PHONE_SERVICE_UNAVAILABLE",
};

/**
 * Writing a verified phone to an account (`userId` in the body) needs that account's own session: a code proves
 * the caller holds the phone, not that the account is theirs. Without `userId` nothing is written (sign-up
 * checks the number first and stores it when the account is created), so no session is needed.
 */
const sessionForUserId = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body?.userId) return next();
  return authenticateToken(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (req.user?.id !== req.body.userId) {
      return res.status(403).json({
        error: "A phone number can only be verified for your own account",
        code: "NOT_YOUR_ACCOUNT",
      });
    }
    next();
  });
};

// Send phone verification code
router.post("/send-verification", ...sendCodeLimiters, async (req, res) => {
  try {
    let { phoneNumber } = req.body;
    phoneNumber = normalizeToE164(phoneNumber);

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ error: "Phone number is required", code: "PHONE_REQUIRED" });
    }

    if (!isTwilioConfigured) {
      console.error("Twilio is not configured");
      return res.status(500).json(SERVICE_UNAVAILABLE);
    }

    // Send verification code using Twilio Verify
    try {
      const verification = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications.create({
          to: phoneNumber,
          channel: "sms",
        });

      return res.status(200).json({
        message: "Verification code sent successfully",
        status: verification.status,
      });
    } catch (error) {
      console.error(
        "Twilio verification error:",
        error instanceof Error ? error.name : "error"
      );
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to send verification code";
      return res.status(400).json({
        error: "Failed to send verification code",
        code: "SEND_CODE_FAILED",
        details: errorMessage,
      });
    }
  } catch (error) {
    console.error("Send verification error:", error);
    return res.status(500).json({
      error: "Failed to send verification code",
      code: "SEND_CODE_FAILED",
    });
  }
});

// Verify phone verification code
router.post(
  "/verify-otp",
  ...checkCodeLimiters,
  sessionForUserId,
  async (req, res) => {
    try {
      let { phoneNumber, code, userId } = req.body as {
        phoneNumber: string;
        code: string;
        userId?: string;
      };
      phoneNumber = normalizeToE164(phoneNumber) as string;

      if (!phoneNumber || !code) {
        return res.status(400).json({
          error: "Phone number and verification code are required",
          code: "PHONE_AND_CODE_REQUIRED",
        });
      }

      if (!isTwilioConfigured) {
        console.error("Twilio is not configured");
        return res.status(500).json(SERVICE_UNAVAILABLE);
      }

      // Verify the code using Twilio Verify
      try {
        const verificationCheck = await twilioClient.verify.v2
          .services(twilioVerifyServiceSid)
          .verificationChecks.create({
            to: phoneNumber,
            code,
          });

        if (verificationCheck.status === "approved") {
          // With a userId (the caller's own, see sessionForUserId): update that user's phone data
          if (userId) {
            const { error: updateError } =
              await supabase.auth.admin.updateUserById(userId, {
                phone: phoneNumber,
              });

            if (updateError) {
              console.error("Error updating user phone:", updateError.code);
            } else {
              // Also set phone_verified in user_metadata
              const { data: userData } =
                await supabase.auth.admin.getUserById(userId);

              if (userData?.user) {
                const currentMetadata = userData.user.user_metadata || {};

                const { error: metadataError } =
                  await supabase.auth.admin.updateUserById(userId, {
                    user_metadata: {
                      ...currentMetadata,
                      phone_verified: true,
                    },
                  });

                if (metadataError) {
                  console.error(
                    "Error updating user metadata:",
                    metadataError.code
                  );
                }
              }
            }
          }

          return res.status(200).json({
            message: "Phone number verified successfully",
            status: verificationCheck.status,
            verified: true,
          });
        } else {
          return res.status(400).json({
            error: "Invalid verification code",
            code: "INVALID_CODE",
            status: verificationCheck.status,
            verified: false,
          });
        }
      } catch (error) {
        console.error(
          "Twilio verification check error:",
          error instanceof Error ? error.name : "error"
        );
        const errorMessage =
          error instanceof Error ? error.message : "Failed to verify code";
        return res.status(400).json({
          error: "Failed to verify code",
          code: "CHECK_CODE_FAILED",
          details: errorMessage,
        });
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      return res
        .status(500)
        .json({ error: "Failed to verify code", code: "CHECK_CODE_FAILED" });
    }
  }
);

export default router;
