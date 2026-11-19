import React from "react";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportTicket } from "../../types/support";
import { SupportStatusBadge } from "./SupportStatusBadge";
import { SupportTypeBadge } from "./SupportTypeBadge";

const formatTicketNumber = (num: number): string => {
  return `SUP-${String(num).padStart(4, "0")}`;
};

const formatDate = (isoStr: string): string => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
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

interface SupportListTableProps {
  tickets: SupportTicket[];
  scope: "mine" | "all";
  onOpen: (path: string) => void;
}

export const SupportListTable: React.FC<SupportListTableProps> = ({
  tickets,
  scope,
  onOpen,
}) => {
  const { t } = useLanguage();

  return (
    <div className="table-container">
      <table className="common-table">
        <thead>
          <tr>
            <th style={{ width: "110px" }}>{t("support.ticketNumber")}</th>
            <th>{t("support.tableTitle")}</th>
            <th style={{ width: "100px" }}>{t("support.type")}</th>
            <th style={{ width: "160px" }}>{t("support.statusTitle")}</th>
            {scope === "all" && <th>{t("support.raisedBy")}</th>}
            <th style={{ width: "170px" }}>{t("support.lastUpdated")}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className="clickable-row"
              onClick={() => onOpen(`/support/${ticket.id}`)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(`/support/${ticket.id}`);
                }
              }}
            >
              <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                {formatTicketNumber(ticket.ticketNumber)}
              </td>
              <td style={{ fontWeight: 500 }}>{ticket.title}</td>
              <td>
                <SupportTypeBadge type={ticket.type} />
              </td>
              <td>
                <SupportStatusBadge status={ticket.status} />
              </td>
              {scope === "all" && (
                <td style={{ fontSize: "13px" }}>
                  {ticket.requesterName || "—"}
                </td>
              )}
              <td
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {formatDate(ticket.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
