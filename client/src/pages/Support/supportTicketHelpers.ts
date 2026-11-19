import { SupportTicketStatus } from "../../types/support";

// Allowed next statuses for agent transition
export const getNextStatuses = (
  current: SupportTicketStatus
): SupportTicketStatus[] => {
  switch (current) {
    case "open":
      return ["in_progress", "waiting_on_client", "resolved"];
    case "in_progress":
      return ["waiting_on_client", "resolved"];
    case "waiting_on_client":
      return ["in_progress", "resolved"];
    case "resolved":
      return ["closed", "in_progress"];
    case "closed":
      return ["in_progress"];
    default:
      return [];
  }
};

export const formatTicketNumber = (num: number): string => {
  return `SUP-${String(num).padStart(4, "0")}`;
};

export const formatDate = (isoStr?: string | null): string => {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
};
