import { validate as validateUuid } from "uuid";
import type { SupportPatchField } from "./support.permissions.js";

/** The five statuses of a ticket. Which move between them is allowed is decided by the database function support_change_status. */
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_client",
  "resolved",
  "closed",
] as const;
export const TICKET_PRIORITIES = ["p1", "p2", "p3"] as const;

/** A change of status to one of these tells the person who raised the ticket (by message). The others tell nobody. */
export const STATUS_TELLS_REQUESTER: ReadonlySet<string> = new Set([
  "waiting_on_client",
  "resolved",
]);

interface FieldRule {
  /** the message answered (with 400) when the value is not acceptable; null when it always is */
  error: string;
  isValid: (value: unknown) => boolean;
  /** `null` in the request body: "no change" (the default) or a value to store (an assignee is cleared with null) */
  nullIsValue?: boolean;
}

/**
 * The fields of PATCH /api/support/tickets/:id, in the order they are checked (the first wrong one is the one
 * answered). A field that is not in the body, or is null (unless `nullIsValue`), is left as it is.
 */
const FIELD_RULES: Record<SupportPatchField, FieldRule> = {
  status: {
    error:
      "status must be one of: open, in_progress, waiting_on_client, resolved, closed",
    isValid: (v) => (TICKET_STATUSES as readonly unknown[]).includes(v),
  },
  priority: {
    error: "priority must be p1, p2, or p3",
    isValid: (v) => (TICKET_PRIORITIES as readonly unknown[]).includes(v),
  },
  title: {
    error: "title must be between 1 and 200 characters",
    isValid: (v) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= 200,
  },
  assignedTo: {
    error: "assignedTo must be a valid UUID or null",
    isValid: (v) => v === null || validateUuid(v as string),
    nullIsValue: true,
  },
  effortHours: {
    error: "effortHours must be a number between 0 and 1000",
    isValid: (v) => {
      const hours = Number(v);
      return !isNaN(hours) && hours >= 0 && hours <= 1000;
    },
  },
};
const CHECK_ORDER: SupportPatchField[] = [
  "status",
  "priority",
  "title",
  "assignedTo",
  "effortHours",
];

export type ParsedTicketPatch =
  | { ok: false; error: string }
  | {
      ok: true;
      /** the status asked for; undefined when the request names none */
      status?: string;
      /** the columns to store as they are, besides the status (priority, trimmed title, assignee) */
      columns: Record<string, unknown>;
      /** the effort asked for, in whole minutes; undefined when the request names none */
      effortMinutes?: number;
    };

const isGiven = (value: unknown, rule: FieldRule) =>
  value !== undefined && (value !== null || rule.nullIsValue === true);

/** Checks every field the person may change before anything is stored, and turns the body into what is stored. */
export function parseTicketPatch(
  body: Record<string, unknown>,
  allowed: readonly SupportPatchField[]
): ParsedTicketPatch {
  for (const field of CHECK_ORDER) {
    if (!allowed.includes(field)) continue;
    const rule = FIELD_RULES[field];
    if (isGiven(body[field], rule) && !rule.isValid(body[field]))
      return { ok: false, error: rule.error };
  }

  const given = (field: SupportPatchField) =>
    allowed.includes(field) && isGiven(body[field], FIELD_RULES[field]);
  const columns: Record<string, unknown> = {};
  if (given("priority")) columns.priority = body.priority;
  if (given("title")) columns.title = (body.title as string).trim();
  if (given("assignedTo")) columns.assigned_to = body.assignedTo;
  return {
    ok: true,
    status: given("status") ? (body.status as string) : undefined,
    columns,
    effortMinutes: given("effortHours")
      ? Math.round(Number(body.effortHours) * 60)
      : undefined,
  };
}
