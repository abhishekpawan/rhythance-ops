import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { createSignInClient } from "../utils/signInClient.js";
import { isRecruiterEmail } from "../utils/recruiterEmail.js";
import {
  checkPhoneCode,
  isStaffUser,
  recordVerifiedSession,
  sessionIdFromToken,
  twoFactorEnforced,
  twoFactorPhone,
} from "../services/staffTwoFactor.js";

dotenv.config();

// Sign-in routes of /api/auth (moved out of auth.ts). Staff two-step login: services/staffTwoFactor.ts.
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY) as string
);
const router = express.Router();

const TWO_FACTOR_REQUIRED = {
  error: "Staff accounts sign in with the two-step login",
  code: "TWO_FACTOR_REQUIRED",
};

// An "email not confirmed" error becomes a normal answer so the screen can offer to resend the email.
async function emailNotConfirmedReply(error: any, email: string) {
  const isEmailNotConfirmed =
    (error.message === "Email not confirmed" ||
      error.code === "email_not_confirmed" ||
      error.message?.toLowerCase().includes("email not confirmed")) &&
    error.code !== "invalid_credentials" &&
    error.message !== "Invalid login credentials";
  if (!isEmailNotConfirmed) return null;
  // Get user by email to verify if email is actually not confirmed
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();
  if (listError || !users) return null;
  const user = users.find((u) => u.email === email);
  if (!user || user.email_confirmed_at) return null;
  return {
    message: "Email not confirmed",
    requiresTwoFactor: false,
    emailVerified: false,
    user,
    email,
  };
}

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const signInClient = createSignInClient();
    const { data, error } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // With enforcement on, staff get a session only through complete-2fa (after the phone code).
    if (isStaffUser(data.user) && (await twoFactorEnforced())) {
      await signInClient.auth.signOut();
      return res.status(403).json(TWO_FACTOR_REQUIRED);
    }

    return res.status(200).json({
      message: "Login successful",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// Validate credentials without creating a session (for the 2FA flow)
router.post("/validate-credentials", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const enforced = await twoFactorEnforced();
    const signInClient = createSignInClient();
    const { data, error } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const notConfirmed = await emailNotConfirmedReply(error, email);
      if (notConfirmed) return res.status(200).json(notConfirmed);
      return res.status(401).json({ error: error.message });
    }

    // Staff: by their role when the server enforces the phone code, otherwise by their email as before.
    const needsTwoFactor = enforced
      ? isStaffUser(data.user)
      : isRecruiterEmail(email);

    if (needsTwoFactor) {
      // Immediately sign out to invalidate the session: staff get one only after the phone code
      await signInClient.auth.signOut();

      // When enforced, the screen must send the code to the number on file, not the editable profile one
      const phone = enforced ? twoFactorPhone(data.user) : null;
      const user = phone
        ? {
            ...data.user,
            user_metadata: { ...data.user.user_metadata, phoneNumber: phone },
          }
        : data.user;

      return res.status(200).json({
        message: "Credentials validated - 2FA required",
        requiresTwoFactor: true,
        emailVerified: true,
        user,
        // Don't return session data
      });
    }

    return res.status(200).json({
      message: "Login successful",
      requiresTwoFactor: false,
      emailVerified: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error("Validate credentials error:", error);
    return res.status(500).json({ error: "Credential validation failed" });
  }
});

// Complete 2FA and create session. Staff: the code is checked here, against the number on file.
router.post("/complete-2fa", async (req, res) => {
  try {
    const { email, password, code } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const signInClient = createSignInClient();
    const { data, error } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (isStaffUser(data.user) && (code || (await twoFactorEnforced()))) {
      const refuse = async (status: number, body: Record<string, string>) => {
        await signInClient.auth.signOut();
        return res.status(status).json(body);
      };
      if (!code) {
        return refuse(400, {
          error: "Verification code required",
          code: "TWO_FACTOR_CODE_REQUIRED",
        });
      }
      const phone = twoFactorPhone(data.user);
      if (!phone) {
        return refuse(400, {
          error: "No phone number on file for two-step login",
          code: "NO_2FA_PHONE",
        });
      }
      if (!(await checkPhoneCode(phone, String(code)))) {
        // 400, not 401: the screen signs the user out and returns to login on any 401
        return refuse(400, {
          error: "Invalid verification code",
          code: "INVALID_2FA_CODE",
        });
      }
      const sessionId = data.session
        ? sessionIdFromToken(data.session.access_token)
        : null;
      if (!sessionId) {
        return refuse(500, { error: "Failed to complete 2FA login" });
      }
      try {
        await recordVerifiedSession(data.user.id, sessionId);
      } catch (recordError) {
        console.error("Complete 2FA error:", recordError);
        return refuse(500, { error: "Failed to complete 2FA login" });
      }
    }

    return res.status(200).json({
      message: "2FA completed - Login successful",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error("Complete 2FA error:", error);
    return res.status(500).json({ error: "Failed to complete 2FA login" });
  }
});

export default router;
