import { isSupportAgent } from "./support.permissions.js";

/**
 * Case Conversion & Allow-List Serialization
 */

function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function convertObjectToCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertObjectToCamelCase(item)) as any;
  }

  if (typeof obj === "object" && !(obj instanceof Date) && !(obj instanceof RegExp)) {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamelCase(key);
      converted[camelKey] = convertObjectToCamelCase(value);
    }
    return converted as T;
  }

  return obj;
}

/**
 * Allow-list serializer for non-agent users.
 * Returns ONLY: id, ticketNumber, type, title,
 * urgency, priority, status, requesterName, requesterRoles, locale,
 * relatedTicketId, resolvedAt, closedAt, confirmedBy, createdAt, updatedAt, isOwner.
 * Never includes requesterId, requesterEmail, assignedTo, context, effortMinutes or idempotencyKey.
 */
export function toPublicTicket(row: any, viewerId?: string) {
  const isOwner = Boolean(
    viewerId && (row.requester_id === viewerId || row.requesterId === viewerId)
  );

  return {
    id: row.id,
    ticketNumber: row.ticketNumber !== undefined ? row.ticketNumber : row.ticket_number,
    type: row.type,
    title: row.title,
    urgency: row.urgency,
    priority: row.priority,
    status: row.status,
    requesterName: row.requesterName !== undefined ? row.requesterName : row.requester_name,
    requesterRoles: row.requesterRoles !== undefined ? row.requesterRoles : (row.requester_roles ?? []),
    locale: row.locale ?? "en",
    relatedTicketId: row.relatedTicketId !== undefined ? row.relatedTicketId : (row.related_ticket_id ?? null),
    resolvedAt: row.resolvedAt !== undefined ? row.resolvedAt : (row.resolved_at ?? null),
    closedAt: row.closedAt !== undefined ? row.closedAt : (row.closed_at ?? null),
    confirmedBy: row.confirmedBy !== undefined ? row.confirmedBy : (row.confirmed_by ?? null),
    createdAt: row.createdAt !== undefined ? row.createdAt : row.created_at,
    updatedAt: row.updatedAt !== undefined ? row.updatedAt : row.updated_at,
    isOwner,
  };
}

/**
 * Allow-list serializer for agent users.
 * Returns public fields plus requesterId, requesterEmail, assignedTo, context, effortMinutes.
 * Never includes idempotencyKey.
 */
export function toAgentTicket(row: any, viewerId?: string) {
  const pub = toPublicTicket(row, viewerId);
  return {
    ...pub,
    requesterId: row.requesterId !== undefined ? row.requesterId : (row.requester_id ?? null),
    requesterEmail: row.requesterEmail !== undefined ? row.requesterEmail : (row.requester_email ?? ""),
    assignedTo: row.assignedTo !== undefined ? row.assignedTo : (row.assigned_to ?? null),
    context: row.context ?? {},
    effortMinutes: row.effortMinutes !== undefined ? row.effortMinutes : (row.effort_minutes ?? null),
  };
}

/**
 * Serializes a ticket row using the allow-list appropriate for the viewer.
 */
export function serializeTicket(row: any, user: Express.Request["user"] | undefined) {
  if (isSupportAgent(user)) {
    return toAgentTicket(row, user?.id);
  }
  return toPublicTicket(row, user?.id);
}

/**
 * Message serializer: returns only id, ticketId, authorName, authorKind, body, createdAt,
 * plus isInternal and authorId for the agent only. Never authorId for non-agents.
 */
export function serializeMessage(row: any, isAgent: boolean) {
  const result: any = {
    id: row.id,
    ticketId: row.ticketId !== undefined ? row.ticketId : row.ticket_id,
    authorName: row.authorName !== undefined ? row.authorName : row.author_name,
    authorKind: row.authorKind !== undefined ? row.authorKind : row.author_kind,
    body: row.body,
    createdAt: row.createdAt !== undefined ? row.createdAt : row.created_at,
  };
  if (isAgent) {
    result.isInternal = Boolean(row.isInternal !== undefined ? row.isInternal : row.is_internal);
    result.authorId = row.authorId !== undefined ? row.authorId : (row.author_id ?? null);
  }
  return result;
}

/**
 * Attachment serializer: only id, fileName, mimeType, sizeBytes, createdAt,
 * plus messageId for the agent only.
 */
export function serializeAttachment(row: any, isAgent: boolean) {
  const result: any = {
    id: row.id,
    fileName: row.fileName !== undefined ? row.fileName : row.file_name,
    mimeType: row.mimeType !== undefined ? row.mimeType : row.mime_type,
    sizeBytes: row.sizeBytes !== undefined ? row.sizeBytes : row.size_bytes,
    createdAt: row.createdAt !== undefined ? row.createdAt : row.created_at,
  };
  if (isAgent) {
    result.messageId = row.messageId !== undefined ? row.messageId : (row.message_id ?? null);
  }
  return result;
}
