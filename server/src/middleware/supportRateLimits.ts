import { Request } from "express";
import rateLimit from "express-rate-limit";

export const ticketCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req: Request) => req.user?.id || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many tickets created, please try again later.",
  },
});

export const messageCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req: Request) => req.user?.id || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many messages sent, please try again later.",
  },
});

export const attachmentSignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req: Request) => req.user?.id || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many attachment upload requests, please try again later.",
  },
});
