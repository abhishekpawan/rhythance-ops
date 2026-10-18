import React, { useState } from "react";
import { Shield, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  SupportTicket,
  SupportStatusEvent,
  SupportTicketStatus,
  SupportTicketPriority,
} from "../../types/support";

interface SupportAgentPanelProps {
  ticket: SupportTicket;
  statusEvents: SupportStatusEvent[];
  elapsedMinutes?: number;
  agentStatus: SupportTicketStatus;
  onAgentStatusChange: (status: SupportTicketStatus) => void;
  agentPriority: SupportTicketPriority;
  onAgentPriorityChange: (priority: SupportTicketPriority) => void;
  agentEffortHours: string;
  onAgentEffortHoursChange: (hours: string) => void;
  savingAgent: boolean;
  agentError: string | null;
  onSaveAgentPanel: () => void;
  getNextStatuses: (current: SupportTicketStatus) => SupportTicketStatus[];
}

export const SupportAgentPanel: React.FC<SupportAgentPanelProps> = ({
  ticket,
  statusEvents,
  elapsedMinutes,
  agentStatus,
  onAgentStatusChange,
  agentPriority,
  onAgentPriorityChange,
  agentEffortHours,
  onAgentEffortHoursChange,
  savingAgent,
  agentError,
  onSaveAgentPanel,
  getNextStatuses,
}) => {
  const { t } = useLanguage();
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  const formatDate = (isoStr?: string | null): string => {
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

  const formatElapsed = (minutes?: number): string => {
    if (minutes === undefined || minutes === null) return "0m";
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="support-agent-panel">
      <div className="support-agent-panel-header">
        <div className="flex items-center gap-2">
          <Shield size={20} style={{ color: "var(--primary)" }} />
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            {t("support.agent.panelTitle")}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-muted" style={{ fontSize: "13px" }}>
          <Clock size={14} />
          <span>
            {t("support.agent.timeOpen")}: <strong>{formatElapsed(elapsedMinutes)}</strong>
          </span>
        </div>
      </div>

      {agentError && (
        <div className="error-message mb-3 flex items-center gap-2" role="alert">
          <AlertCircle size={14} />
          <span>{agentError}</span>
        </div>
      )}

      <div className="support-agent-grid">
        <div>
          <label className="form-label" style={{ fontSize: "12px" }}>
            {t("support.agent.requesterInfo")}
          </label>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>
            {ticket.requesterName || "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {ticket.requesterEmail || "—"}
          </div>
        </div>

        <div>
          <label htmlFor="agent-status-select" className="form-label" style={{ fontSize: "12px" }}>
            {t("support.agent.statusLabel")}
          </label>
          <select
            id="agent-status-select"
            className="form-input"
            value={agentStatus}
            onChange={(e) => onAgentStatusChange(e.target.value as SupportTicketStatus)}
          >
            <option value={ticket.status}>
              {t(`support.status.${ticket.status}`)} ({t("support.agent.currentStatus")})
            </option>
            {getNextStatuses(ticket.status).map((st) => (
              <option key={st} value={st}>
                {t(`support.status.${st}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="agent-priority-select" className="form-label" style={{ fontSize: "12px" }}>
            {t("support.agent.priorityLabel")}
          </label>
          <select
            id="agent-priority-select"
            className="form-input"
            value={agentPriority}
            onChange={(e) => onAgentPriorityChange(e.target.value as SupportTicketPriority)}
          >
            <option value="p1">P1 - Urgent</option>
            <option value="p2">P2 - High</option>
            <option value="p3">P3 - Normal</option>
          </select>
        </div>

        <div>
          <label htmlFor="agent-effort-hours" className="form-label" style={{ fontSize: "12px" }}>
            {t("support.agent.hoursSpent")}
          </label>
          <input
            id="agent-effort-hours"
            type="number"
            step="0.1"
            min="0"
            max="1000"
            className="form-input"
            value={agentEffortHours}
            onChange={(e) => onAgentEffortHoursChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          type="button"
          className="button primary"
          onClick={onSaveAgentPanel}
          disabled={savingAgent}
        >
          {savingAgent ? t("support.agent.saving") : t("support.agent.saveButton")}
        </button>
      </div>

      {/* Status History */}
      {statusEvents.length > 0 && (
        <div className="support-status-history">
          <span className="support-status-history-title">
            {t("support.agent.statusHistory")}:
          </span>
          <div className="support-status-history-list">
            {statusEvents.map((ev) => {
              const fromSt = ev.fromStatus ?? ev.oldStatus;
              const toSt = ev.toStatus ?? ev.newStatus;

              let actor = ev.actorName || "";
              if (!actor) {
                if (ev.actorKind === "system" || (!ev.changedBy && !ev.actorKind)) {
                  actor = "System";
                } else if (
                  ev.actorKind === "requester" ||
                  (ev.changedBy && ev.changedBy === ticket.requesterId)
                ) {
                  actor = ticket.requesterName || "Requester";
                } else if (ev.actorKind === "agent" || ev.changedBy) {
                  actor = "Support Team";
                }
              }

              const fromLabel = fromSt ? t(`support.status.${fromSt}`) : null;
              const toLabel = toSt ? t(`support.status.${toSt}`) : "";

              return (
                <div key={ev.id} className="support-status-history-item">
                  <span className="support-status-history-bullet">•</span>
                  <span className="support-status-history-date">{formatDate(ev.createdAt)}:</span>{" "}
                  {fromLabel && (
                    <span className="support-status-history-from">
                      {fromLabel} →{" "}
                    </span>
                  )}
                  <strong className="support-status-history-to">{toLabel}</strong>
                  {actor && (
                    <span className="support-status-history-actor"> ({actor})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Technical Details */}
      {ticket.context && (
        <details
          className="support-tech-details"
          open={techDetailsOpen}
          onToggle={(e) => setTechDetailsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex items-center gap-1">
            <span>{t("support.agent.technicalDetails")}</span>
            {techDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </summary>
          <div className="support-tech-content">
            {JSON.stringify(ticket.context, null, 2)}
          </div>
        </details>
      )}
    </div>
  );
};
