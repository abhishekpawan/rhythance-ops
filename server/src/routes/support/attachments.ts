import { Router, Request, Response } from "express";
import { v4 as uuidv4, validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { attachmentSignLimiter } from "../../middleware/supportRateLimits.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  isSupportRequester,
  isSupportAdmin,
} from "../../services/support.permissions.js";
import { notFoundResponse } from "../../services/support.errors.js";
import {
  validateFileMimeAndExt,
  sanitizeFileName,
} from "../../services/support.attachments.js";

const router = Router();

/**
 * POST /api/support/attachments/sign
 * Validate mime, extension, size, sanitize name. Create signed upload URL in 'support-attachments'
 * at `pending/{userId}/{uuid}-{sanitizedName}`. Returns { uploadUrl, token, path }.
 */
router.post(
  "/attachments/sign",
  authenticateToken,
  attachmentSignLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!isSupportRequester(req.user) && !isSupportAgent(req.user)) {
        return notFoundResponse(res);
      }

      const { fileName, mimeType, sizeBytes } = req.body || {};

      if (!fileName || typeof fileName !== "string") {
        return res.status(400).json({ success: false, error: "fileName is required" });
      }

      if (!mimeType || typeof mimeType !== "string") {
        return res.status(400).json({ success: false, error: "mimeType is required" });
      }

      if (!validateFileMimeAndExt(fileName, mimeType)) {
        return res.status(400).json({ success: false, error: "Invalid file type or extension mismatch" });
      }

      const numBytes = Number(sizeBytes);
      if (isNaN(numBytes) || numBytes <= 0 || numBytes > 10485760) {
        return res.status(400).json({ success: false, error: "sizeBytes must be between 1 and 10485760 (10MB)" });
      }

      const sanitized = sanitizeFileName(fileName);
      const uniquePath = `pending/${req.user!.id}/${uuidv4()}-${sanitized}`;

      const { data, error } = await supabase.storage
        .from("support-attachments")
        .createSignedUploadUrl(uniquePath);

      if (error || !data) {
        console.error("Error creating signed upload URL:", error);
        return res.status(500).json({ success: false, error: "Failed to create upload URL" });
      }

      return res.json({
        success: true,
        uploadUrl: data.signedUrl,
        token: data.token,
        path: uniquePath,
      });
    } catch (err: any) {
      console.error("POST /attachments/sign unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

/**
 * GET /api/support/attachments/:id/url
 * Signed download URL (expires in 300s). Attachments visible only to owner, admin, agent. Otherwise 404.
 * Internal-note attachments return 404 for non-agents.
 */
router.get(
  "/attachments/:id/url",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!validateUuid(id)) {
        return notFoundResponse(res);
      }

      const { data: attachment, error: attError } = await supabase
        .from("support_ticket_attachments")
        .select("*, support_tickets(requester_id)")
        .eq("id", id)
        .single();

      if (attError || !attachment) {
        return notFoundResponse(res);
      }

      const isAgent = isSupportAgent(req.user);

      // If the attachment belongs to an internal message and caller is not agent -> 404
      if (attachment.message_id) {
        const { data: msg } = await supabase
          .from("support_ticket_messages")
          .select("is_internal")
          .eq("id", attachment.message_id)
          .single();

        if (msg?.is_internal && !isAgent) {
          return notFoundResponse(res);
        }
      }

      const ticketOwnerId = (attachment as any).support_tickets?.requester_id;
      const isOwner = req.user!.id === ticketOwnerId;
      const isAdmin = isSupportAdmin(req.user);

      // Attachments only for the owner, admin, and agent
      if (!isOwner && !isAdmin && !isAgent) {
        return notFoundResponse(res);
      }

      const { data, error } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(attachment.storage_path, 300);

      if (error || !data) {
        console.error("Error creating signed download URL:", error);
        return res.status(500).json({ success: false, error: "Failed to generate download URL" });
      }

      return res.json({
        success: true,
        url: data.signedUrl,
      });
    } catch (err: any) {
      console.error("GET /attachments/:id/url unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
