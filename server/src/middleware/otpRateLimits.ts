import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { phoneDigits } from "../utils/phoneNumber.js";

/**
 * Limits for the two public phone-code endpoints (`POST /api/auth/send-verification`, `POST /api/auth/verify-otp`).
 * Each request counts against the caller's address and against the phone number it names: the address limit stops
 * one source from texting many numbers, the number limit stops many sources from texting one number.
 * Counts are kept in the server's memory (one process per portal) and start again when it restarts.
 * The numbers can be changed per portal with environment values (see server/.env.example); a missing or invalid
 * value uses the default.
 */
const fromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const OTP_LIMITS = {
  windowMs: fromEnv("OTP_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000),
  /** SMS sends per number per window. */
  sendPerNumber: fromEnv("OTP_SEND_LIMIT_PER_NUMBER", 8),
  /** SMS sends per address per window (an office behind one address signs in several people). */
  sendPerAddress: fromEnv("OTP_SEND_LIMIT_PER_ADDRESS", 100),
  /** Code checks per number per window. */
  checkPerNumber: fromEnv("OTP_CHECK_LIMIT_PER_NUMBER", 20),
  /** Code checks per address per window. */
  checkPerAddress: fromEnv("OTP_CHECK_LIMIT_PER_ADDRESS", 200),
} as const;

const tooMany = (_req: Request, res: Response) =>
  res.status(429).json({
    error: "Too many requests, please try again later.",
    code: "RATE_LIMITED",
  });

const byAddress = (max: number) =>
  rateLimit({
    windowMs: OTP_LIMITS.windowMs,
    max,
    keyGenerator: (req: Request) => req.ip || "unknown",
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany,
  });

const numberOf = (req: Request) => phoneDigits(req.body?.phoneNumber);

// A request that names no number has nothing to count here; the route answers 400 and the address limit applies.
const byNumber = (max: number) =>
  rateLimit({
    windowMs: OTP_LIMITS.windowMs,
    max,
    keyGenerator: (req: Request) => `number:${numberOf(req)}`,
    skip: (req: Request) => !numberOf(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany,
  });

export const sendCodeLimiters = [
  byAddress(OTP_LIMITS.sendPerAddress),
  byNumber(OTP_LIMITS.sendPerNumber),
];

export const checkCodeLimiters = [
  byAddress(OTP_LIMITS.checkPerAddress),
  byNumber(OTP_LIMITS.checkPerNumber),
];
