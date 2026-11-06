import { Request, Response, NextFunction } from "express";

/** Allows only users that have the `superadmin` role. Use after authenticateToken. */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userRoles = req.user.user_metadata?.user_role;
  if (!Array.isArray(userRoles) || !userRoles.includes("superadmin")) {
    return res.status(403).json({ error: "Access denied. Super admin only." });
  }
  next();
}
