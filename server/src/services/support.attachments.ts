import { supabase } from "./support.db.js";

export const MIME_EXTENSION_MAP: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".text", ".log", ".plain"],
  "text/csv": [".csv"],
};

export function validateFileMimeAndExt(fileName: string, mimeType: string): boolean {
  if (!fileName || !mimeType) return false;
  const normalizedMime = mimeType.toLowerCase().trim();
  const allowedExtensions = MIME_EXTENSION_MAP[normalizedMime];
  if (!allowedExtensions) return false;

  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const ext = fileName.slice(dotIdx).toLowerCase().trim();
  return allowedExtensions.includes(ext);
}

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.replace(/^.*[\\\/]/, "");
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.slice(0, 100) || "attachment";
}

export interface PendingAttachmentInput {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates attachments BEFORE mutating the database.
 * Checks path prefix, mime/extension, size <= 10MB, storage existence & size match, count <= 5.
 */
export async function validateAttachments(
  attachments: PendingAttachmentInput[] | undefined,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return { success: true };
  }

  if (attachments.length > 5) {
    return { success: false, error: "Maximum 5 attachments allowed" };
  }

  for (const att of attachments) {
    if (!att || typeof att !== "object") {
      return { success: false, error: "Invalid attachment format" };
    }

    if (!att.path || typeof att.path !== "string") {
      return { success: false, error: "Attachment path is required" };
    }

    const expectedPrefix = `pending/${userId}/`;
    if (!att.path.startsWith(expectedPrefix)) {
      return { success: false, error: `Invalid attachment path prefix: ${att.path}` };
    }

    if (!att.fileName || !att.mimeType || typeof att.sizeBytes !== "number") {
      return { success: false, error: "Attachment missing required metadata" };
    }

    if (!validateFileMimeAndExt(att.fileName, att.mimeType)) {
      return {
        success: false,
        error: `Invalid attachment MIME type or extension mismatch for ${att.fileName}`,
      };
    }

    if (att.sizeBytes <= 0 || att.sizeBytes > 10485760) {
      return { success: false, error: `Attachment size exceeds 10MB limit: ${att.fileName}` };
    }

    // Verify object exists in storage bucket with matching size
    const folderPath = `pending/${userId}`;
    const fileNameInFolder = att.path.slice(expectedPrefix.length);

    const { data: fileList, error: listError } = await supabase.storage
      .from("support-attachments")
      .list(folderPath, { search: fileNameInFolder });

    if (listError || !fileList) {
      return { success: false, error: `Failed to check storage for ${att.fileName}` };
    }

    const matchedFile = fileList.find((f) => f.name === fileNameInFolder);
    if (!matchedFile) {
      return { success: false, error: `Attachment not found in storage: ${att.path}` };
    }

    const actualSize = (matchedFile.metadata as any)?.size;
    if (actualSize !== undefined && actualSize !== att.sizeBytes) {
      return { success: false, error: `Attachment size mismatch for ${att.fileName}` };
    }
  }

  return { success: true };
}

/**
 * Idempotently inserts attachment rows into support_ticket_attachments.
 * Uses upsert with onConflict 'storage_path' and ignoreDuplicates true.
 */
export async function insertAttachmentRows(
  ticketId: string,
  messageId: string | null,
  userId: string,
  attachments: PendingAttachmentInput[] | undefined
): Promise<{ success: boolean; error?: string }> {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return { success: true };
  }

  const rows = attachments.map((att) => ({
    ticket_id: ticketId,
    message_id: messageId,
    storage_path: att.path,
    file_name: sanitizeFileName(att.fileName),
    mime_type: att.mimeType,
    size_bytes: att.sizeBytes,
    uploaded_by: userId,
  }));

  const { error: insertError } = await supabase
    .from("support_ticket_attachments")
    .upsert(rows, { onConflict: "storage_path", ignoreDuplicates: true });

  if (insertError) {
    console.error("Error inserting attachments:", insertError);
    return { success: false, error: "Failed to persist attachment metadata" };
  }

  return { success: true };
}
