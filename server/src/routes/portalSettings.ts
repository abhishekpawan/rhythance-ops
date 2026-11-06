import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/superAdmin.js";
import activityLogger from "../middleware/activityLogger.js";
import {
  PortalSettingsError,
  getEffectivePortalSettings,
  getPortalSettingsSnapshot,
  setPortalSettings,
} from "../services/portalSettings.js";

const router = Router();

function actorOf(req: Request): { id: string; name: string } {
  return {
    id: req.user?.id ?? "",
    name: req.user?.user_metadata?.name || req.user?.email || "Super admin",
  };
}

function sendError(res: Response, error: unknown) {
  if (error instanceof PortalSettingsError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Unexpected portal settings error:", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

/**
 * GET /api/portal-settings
 * Value of every setting. Any logged-in user: the client needs these to render
 * invoices, titles and so on. Contains only the values, no metadata.
 */
router.get("/", authenticateToken, async (_req: Request, res: Response) => {
  try {
    res.json({ values: await getEffectivePortalSettings() });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/portal-settings/admin
 * Every setting with its source and last change, for the super-admin page.
 */
router.get(
  "/admin",
  authenticateToken,
  requireSuperAdmin,
  async (_req: Request, res: Response) => {
    try {
      res.json(await getPortalSettingsSnapshot());
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * PUT /api/portal-settings   body: { values: { "<key>": "<text>" } }
 * An empty value removes the stored value (back to environment / default).
 */
router.put(
  "/",
  authenticateToken,
  requireSuperAdmin,
  activityLogger({
    onSuccess: (req, res) => {
      const changed =
        (res.locals.changedSettings as string[] | undefined) || [];
      const actorName = actorOf(req).name;
      return {
        actionType: "update_portal_settings",
        actionVerb: "updated",
        primaryEntityType: "portal_settings",
        primaryEntityName: "portal settings",
        displayMessage: `${actorName} updated portal settings (${changed.join(", ")})`,
        category: "system",
        priority: "normal",
        metadata: { changed },
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const values = req.body?.values;
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        return res.status(400).json({ error: "`values` must be an object" });
      }
      const snapshot = await setPortalSettings(values, actorOf(req));
      res.locals.changedSettings = Object.keys(values);
      res.json(snapshot);
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
