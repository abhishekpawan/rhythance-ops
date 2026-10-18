export type SupportTicketType = "bug" | "change" | "feature" | "question";
export type SupportTicketUrgency = "blocked" | "annoying" | "not_urgent";
export type SupportTicketPriority = "p1" | "p2" | "p3";
export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_client"
  | "resolved"
  | "closed";
export type SupportActorKind = "requester" | "agent" | "system";
export type SupportConfirmedBy = "client" | "auto" | "agent";

export interface SupportAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
  messageId?: string | null;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorName: string;
  authorKind: SupportActorKind;
  body: string;
  createdAt: string;
  isInternal?: boolean;
  authorId?: string | null;
}

export interface SupportTicketStatusEvent {
  id: string;
  ticketId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  createdAt: string;
  actorName?: string;
  actorKind?: string;
  oldStatus?: string | null;
  newStatus?: string;
}
export type SupportStatusEvent = SupportTicketStatusEvent;

export interface SupportFailedRequest {
  method: string;
  path: string;
  status: number;
  time: string;
}

export interface SupportContext {
  route?: string;
  fromPage?: string;
  language?: string;
  browser?: string;
  os?: string;
  build?: string;
  consoleErrors?: string[];
  failedRequests?: SupportFailedRequest[];
  userId?: string;
  roles?: string[];
  deployment?: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  type: SupportTicketType;
  areaKey: string;
  areaLabel: string;
  pageUrl?: string | null;
  title: string;
  urgency: SupportTicketUrgency;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  requesterName: string;
  requesterRoles: string[];
  locale: string;
  relatedTicketId?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  confirmedBy?: SupportConfirmedBy | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  // Agent only:
  requesterId?: string | null;
  requesterEmail?: string;
  assignedTo?: string | null;
  context?: SupportContext;
  effortMinutes?: number | null;
  // Detail views:
  messages?: SupportMessage[];
  attachments?: SupportAttachment[];
  statusEvents?: SupportTicketStatusEvent[];
  elapsedMinutes?: number;
}

export interface SupportTicketDetailResponse {
  success: boolean;
  ticket: SupportTicket;
  messages?: SupportMessage[];
  attachments?: SupportAttachment[];
  statusEvents?: SupportTicketStatusEvent[];
  elapsedMinutes?: number;
}

export interface SupportTicketListResponse {
  success: boolean;
  tickets: SupportTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface PendingAttachmentUpload {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}
export type CreateAttachmentInput = PendingAttachmentUpload;

export interface CreateTicketInput {
  type: SupportTicketType;
  areaKey: string;
  areaLabel: string;
  pageUrl?: string | null;
  description: string;
  urgency: SupportTicketUrgency;
  context?: SupportContext;
  locale: string;
  idempotencyKey: string;
  attachments?: PendingAttachmentUpload[];
}

export interface AddMessageInput {
  body: string;
  isInternal?: boolean;
  attachments?: PendingAttachmentUpload[];
}

export interface PatchTicketInput {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  title?: string;
  assignedTo?: string | null;
  effortHours?: number;
}
