import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/superAdmin.js";
import activityLogger from "../middleware/activityLogger.js";
import { PORTALS, getFeatureFlagDefinition } from "../config/featureFlags.js";
import {
  FeatureFlagError,
  getEffectiveFlags,
  getFeatureFlagSnapshot,
  resetFeatureFlag,
  setFeatureFlag,
} from "../services/featureFlags.js";

const router = Router();

function actorOf(req: Request): { id: string; name: string } {
  return {
    id: req.user?.id ?? "",
    name: req.user?.user_metadata?.name || req.user?.email || "Super admin",
  };
}

function sendError(res: Response, error: unknown) {
  if (error instanceof FeatureFlagError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Unexpected feature flag error:", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

/**
 * GET /api/feature-flags
 * Effective on/off value of every flag. Any logged-in user (the client needs it
 * to decide what to render). Contains no metadata, only booleans.
 */
router.get("/", authenticateToken, async (_req: Request, res: Response) => {
  try {
    res.json({ flags: await getEffectiveFlags() });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/feature-flags/admin
 * Full registry + current state for the super-admin page.
 */
router.get(
  "/admin",
  authenticateToken,
  requireSuperAdmin,
  async (_req: Request, res: Response) => {
    try {
      const snapshot = await getFeatureFlagSnapshot();
      res.json({ ...snapshot, portals: PORTALS });
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * PUT /api/feature-flags/:key   body: { enabled: boolean }
 */
router.put(
  "/:key",
  authenticateToken,
  requireSuperAdmin,
  activityLogger({
    onSuccess: (req, res) => {
      const change = res.locals.flagChange as
        | { title: string; enabled: boolean }
        | undefined;
      const actorName = actorOf(req).name;
      return {
        actionType: "update_feature_flag",
        actionVerb: change?.enabled ? "enabled" : "disabled",
        primaryEntityType: "feature_flag",
        primaryEntityId: req.params.key,
        primaryEntityName: change?.title || req.params.key,
        displayMessage: `${actorName} ${change?.enabled ? "enabled" : "disabled"} feature "${change?.title || req.params.key}"`,
        category: "system",
        priority: "normal",
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { enabled } = req.body || {};

      const def = getFeatureFlagDefinition(key);
      if (!def) {
        return res.status(404).json({ error: `Unknown feature flag "${key}"` });
      }
      if (typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ error: "`enabled` must be true or false" });
      }
      if (!def.wired) {
        return res.status(409).json({
          error:
            "This flag is tracked but not connected to any code yet, so it cannot be changed.",
        });
      }

      const flag = await setFeatureFlag(key, enabled, actorOf(req));
      res.locals.flagChange = { title: def.title, enabled };
      res.json({ flag });
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * DELETE /api/feature-flags/:key
 * Removes the override: the flag returns to its in-code default.
 */
router.delete(
  "/:key",
  authenticateToken,
  requireSuperAdmin,
  activityLogger({
    onSuccess: (req, res) => {
      const change = res.locals.flagChange as { title: string } | undefined;
      const actorName = actorOf(req).name;
      return {
        actionType: "update_feature_flag",
        actionVerb: "reset",
        primaryEntityType: "feature_flag",
        primaryEntityId: req.params.key,
        primaryEntityName: change?.title || req.params.key,
        displayMessage: `${actorName} reset feature "${change?.title || req.params.key}" to its default`,
        category: "system",
        priority: "normal",
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const def = getFeatureFlagDefinition(key);
      if (!def) {
        return res.status(404).json({ error: `Unknown feature flag "${key}"` });
      }
      if (!def.wired) {
        return res.status(409).json({
          error:
            "This flag is tracked but not connected to any code yet, so it cannot be changed.",
        });
      }

      const flag = await resetFeatureFlag(key);
      res.locals.flagChange = { title: def.title };
      res.json({ flag });
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
