import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getAssignmentFromEmail,
  getNoReplyFromEmail,
} from "../middleware/emailNotifier.js";
import { getPortalSettingSync } from "../services/portalSettings.js";
import { TEMPLATES } from "./emailTemplates/registry.js";

const router = Router();

// Middleware: require super admin
function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userRoles = req.user.user_metadata?.user_role;
  if (!Array.isArray(userRoles) || !userRoles.includes("superadmin")) {
    return res.status(403).json({ error: "Access denied. Super admin only." });
  }
  next();
}

function getTemplateFromEmail(templateId: string): string {
  if (
    templateId === "jobseeker-assignment" ||
    templateId === "jobseeker-removal"
  ) {
    return getAssignmentFromEmail();
  }

  return getNoReplyFromEmail();
}

// Helper: build CC list from ENV
function getInvoiceCcEmails(): string[] {
  return getPortalSettingSync("email.invoiceCc")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// GET /api/email-templates — List all templates
router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  (_req: Request, res: Response) => {
    const ccEmails = getInvoiceCcEmails();

    const list = TEMPLATES.map(
      ({
        id,
        name,
        subject,
        description,
        service,
        tone,
        triggerRef,
        attachments,
        dynamicCc,
        renderText,
      }) => ({
        id,
        name,
        subject,
        description,
        service,
        tone,
        triggerRef,
        attachments,
        from: getTemplateFromEmail(id),
        cc: id === "invoice" ? ccEmails : [],
        dynamicCc: dynamicCc || false,
        hasTextVersion: renderText !== null,
      })
    );
    res.json(list);
  }
);

// GET /api/email-templates/:templateId/preview — Render a template with sample data
router.get(
  "/:templateId/preview",
  authenticateToken,
  requireSuperAdmin,
  (req: Request, res: Response) => {
    const { templateId } = req.params;
    const template = TEMPLATES.find((t) => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const ccEmails = getInvoiceCcEmails();

    try {
      const html = template.renderHtml(template.sampleData);
      const text = template.renderText
        ? template.renderText(template.sampleData)
        : null;

      res.json({
        id: template.id,
        name: template.name,
        subject: template.subject,
        description: template.description,
        service: template.service,
        tone: template.tone,
        triggerRef: template.triggerRef,
        attachments: template.attachments,
        from: getTemplateFromEmail(template.id),
        cc: template.id === "invoice" ? ccEmails : [],
        dynamicCc: template.dynamicCc || false,
        html,
        text,
        sampleData: template.sampleData,
      });
    } catch (err: any) {
      console.error(`Error rendering template ${templateId}:`, err);
      res
        .status(500)
        .json({ error: "Failed to render template", details: err.message });
    }
  }
);

export default router;
