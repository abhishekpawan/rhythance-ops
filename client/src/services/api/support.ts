import axios from "axios";
import { api, clearCacheFor } from "./index";
import { supabase } from "../../lib/supabaseClient";
import {
  SupportTicket,
  SupportTicketDetailResponse,
  SupportTicketListResponse,
  SupportMessage,
  CreateTicketInput,
  AddMessageInput,
  PatchTicketInput,
  PendingAttachmentUpload,
} from "../../types/support";

/**
 * Creates a custom error carrying HTTP status and server error code (e.g. 409, 429).
 */
function handleApiError(error: unknown, fallbackMessage: string): never {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as any;
    const msg = data?.error || fallbackMessage;
    const err = new Error(msg);
    (err as any).status = error.response.status;
    (err as any).code = data?.code;
    throw err;
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(fallbackMessage);
}

/**
 * Signs an upload URL for an attachment in 'support-attachments'.
 */
export async function signAttachmentUpload(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): Promise<{ uploadUrl: string; token: string; path: string }> {
  try {
    const res = await api.post("/api/support/attachments/sign", {
      fileName,
      mimeType,
      sizeBytes,
    });
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to sign attachment upload");
  }
}

/**
 * Uploads a local file to Supabase Storage via signed URL.
 */
export async function uploadSupportAttachment(
  file: File
): Promise<PendingAttachmentUpload> {
  const { token, path } = await signAttachmentUpload(
    file.name,
    file.type,
    file.size
  );

  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .uploadToSignedUrl(path, token, file);

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload file to storage");
  }

  return {
    path,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

/**
 * Gets a signed download URL for an attachment (valid for 5 minutes).
 */
export async function getAttachmentDownloadUrl(
  attachmentId: string
): Promise<string> {
  try {
    const res = await api.get(`/api/support/attachments/${attachmentId}/url`);
    return res.data.url;
  } catch (error) {
    return handleApiError(error, "Failed to get attachment download link");
  }
}

/**
 * Fetches paginated support tickets with optional scope and status filters.
 */
export async function getTickets(params: {
  scope?: "mine" | "all";
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<SupportTicketListResponse> {
  try {
    const query = new URLSearchParams();
    if (params.scope) query.append("scope", params.scope);
    if (params.status) query.append("status", params.status);
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));

    const qs = query.toString();
    const url = qs ? `/api/support/tickets?${qs}` : "/api/support/tickets";
    const res = await api.get<SupportTicketListResponse>(url);
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to fetch tickets");
  }
}

/**
 * Fetches ticket detail by ID including messages and attachment metadata.
 */
export async function getTicketById(
  id: string
): Promise<SupportTicketDetailResponse> {
  try {
    const res = await api.get<SupportTicketDetailResponse>(`/api/support/tickets/${id}`);
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to fetch ticket");
  }
}

/**
 * Creates a new support ticket.
 * Clears the in-memory cache for /api/support.
 */
export async function createTicket(
  input: CreateTicketInput
): Promise<{ success: boolean; ticket: SupportTicket }> {
  try {
    const res = await api.post<{ success: boolean; ticket: SupportTicket }>(
      "/api/support/tickets",
      input
    );
    clearCacheFor("/api/support");
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to create ticket");
  }
}

/**
 * Appends a message (or reply) to a ticket thread.
 * Clears the in-memory cache for /api/support.
 */
export async function addTicketMessage(
  ticketId: string,
  input: AddMessageInput
): Promise<{ success: boolean; message: SupportMessage }> {
  try {
    const res = await api.post<{ success: boolean; message: SupportMessage }>(
      `/api/support/tickets/${ticketId}/messages`,
      input
    );
    clearCacheFor("/api/support");
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to send message");
  }
}

/**
 * Confirms resolution of a ticket by the owner ('closed').
 * Clears the in-memory cache for /api/support.
 */
export async function confirmTicketResolution(
  ticketId: string
): Promise<{ success: boolean; ticket: SupportTicket }> {
  try {
    const res = await api.post<{ success: boolean; ticket: SupportTicket }>(
      `/api/support/tickets/${ticketId}/confirm`
    );
    clearCacheFor("/api/support");
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to confirm resolution");
  }
}

/**
 * Reopens a resolved or closed ticket (owner or agent).
 * Clears the in-memory cache for /api/support.
 */
export async function reopenTicket(
  ticketId: string,
  body?: string
): Promise<{ success: boolean; ticket: SupportTicket }> {
  try {
    const res = await api.post<{ success: boolean; ticket: SupportTicket }>(
      `/api/support/tickets/${ticketId}/reopen`,
      { body }
    );
    clearCacheFor("/api/support");
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to reopen ticket");
  }
}

/**
 * Agent patch for updating ticket status, priority, title, effort, or assignment.
 * Clears the in-memory cache for /api/support.
 */
export async function patchTicket(
  ticketId: string,
  input: PatchTicketInput
): Promise<{ success: boolean; ticket: SupportTicket }> {
  try {
    const res = await api.patch<{ success: boolean; ticket: SupportTicket }>(
      `/api/support/tickets/${ticketId}`,
      input
    );
    clearCacheFor("/api/support");
    return res.data;
  } catch (error) {
    return handleApiError(error, "Failed to update ticket");
  }
}
