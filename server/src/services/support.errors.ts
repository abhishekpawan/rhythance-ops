import { Response } from "express";

/**
 * Standard 404 response for unauthorized / wrong-role callers or not found resources.
 * Rule: never answer with 401 or 403 (client logs user out).
 */
export function notFoundResponse(res: Response) {
  return res.status(404).json({ success: false, error: "Not found" });
}

/**
 * Maps database exceptions and RPC error messages to HTTP statuses and codes.
 */
export function handleDbError(error: any, res: Response): boolean {
  if (!error) return false;
  const msg = error.message || String(error);

  const match = msg.match(
    /^(IDEMPOTENCY_CONFLICT|INVALID_TRANSITION|REOPEN_WINDOW_EXPIRED|MESSAGE_LIMIT|INTERNAL_NOT_ALLOWED|TICKET_NOT_FOUND|INVALID_ACTOR):/
  );

  if (match) {
    const code = match[1];
    if (
      code === "IDEMPOTENCY_CONFLICT" ||
      code === "INVALID_TRANSITION" ||
      code === "REOPEN_WINDOW_EXPIRED" ||
      code === "MESSAGE_LIMIT"
    ) {
      res.status(409).json({ success: false, error: msg, code });
      return true;
    }
    if (code === "INTERNAL_NOT_ALLOWED") {
      res.status(400).json({ success: false, error: msg, code });
      return true;
    }
    if (code === "TICKET_NOT_FOUND") {
      res.status(404).json({ success: false, error: "Not found", code });
      return true;
    }
    if (code === "INVALID_ACTOR") {
      res.status(500).json({ success: false, error: msg, code });
      return true;
    }
  }

  return false;
}
