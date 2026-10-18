import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  getTicketById,
  addTicketMessage,
  confirmTicketResolution,
  reopenTicket,
  patchTicket,
  getAttachmentDownloadUrl,
} from "../../services/api/support";
import {
  SupportTicket,
  SupportMessage,
  SupportAttachment,
  SupportStatusEvent,
  SupportTicketStatus,
  SupportTicketPriority,
  CreateAttachmentInput,
} from "../../types/support";
import { SupportStatusBadge } from "./SupportStatusBadge";
import { SupportTypeBadge } from "./SupportTypeBadge";
import { SupportResolutionPanel } from "./SupportResolutionPanel";
import { SupportThread } from "./SupportThread";
import { SupportReplyBox } from "./SupportReplyBox";
import { SupportAgentPanel } from "./SupportAgentPanel";
import { isSuperAdmin } from "../../lib/auth";
import "../../styles/pages/Support.css";

export const SupportTicketPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const superAdmin = isSuperAdmin(user);

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [statusEvents, setStatusEvents] = useState<SupportStatusEvent[]>([]);
  const [elapsedMinutes, setElapsedMinutes] = useState<number | undefined>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reply state
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<CreateAttachmentInput[]>([]);
  const [replyIsUploading, setReplyIsUploading] = useState(false);
  const [replyIsInternal, setReplyIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Reopen modal/box state
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Agent panel form state
  const [agentStatus, setAgentStatus] = useState<SupportTicketStatus>("open");
  const [agentPriority, setAgentPriority] = useState<SupportTicketPriority>("p3");
  const [agentEffortHours, setAgentEffortHours] = useState<string>("");
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const fetchTicketDetails = useCallback(
    async (isManualRefresh = false) => {
      if (!id) return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      setGeneralError(null);
      setNotFound(false);

      try {
        const data = await getTicketById(id);
        setTicket(data.ticket);
        setMessages(data.messages || []);
        setAttachments(data.attachments || []);
        setStatusEvents(data.statusEvents || []);
        setElapsedMinutes(
          data.elapsedMinutes ??
            (data.ticket.effortMinutes != null ? data.ticket.effortMinutes : undefined)
        );

        // Pre-fill agent controls
        setAgentStatus(data.ticket.status);
        setAgentPriority(data.ticket.priority || "p3");
        if (data.ticket.effortMinutes !== undefined && data.ticket.effortMinutes !== null) {
          setAgentEffortHours((data.ticket.effortMinutes / 60).toFixed(2));
        } else {
          setAgentEffortHours("");
        }
      } catch (err: any) {
        if (err?.status === 404) {
          setNotFound(true);
        } else if (err?.status === 429) {
          setGeneralError(t("support.errors.rateLimited"));
        } else {
          setGeneralError(err?.message || t("support.errors.loadFailed"));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, t]
  );

  useEffect(() => {
    fetchTicketDetails();
  }, [fetchTicketDetails]);

  // Refetch on window focus
  useEffect(() => {
    const onFocus = () => {
      fetchTicketDetails(true);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchTicketDetails]);

  // Allowed next statuses for agent transition
  const getNextStatuses = (current: SupportTicketStatus): SupportTicketStatus[] => {
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

  const handleDownloadAttachment = async (attId: string) => {
    try {
      const url = await getAttachmentDownloadUrl(attId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error("Failed to download attachment:", err);
      alert(t("support.errors.downloadFailed") || "Failed to download attachment");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !replyBody.trim()) return;
    if (replyIsUploading) {
      setReplyError(t("support.new.uploadInProgress"));
      return;
    }

    setSendingReply(true);
    setReplyError(null);

    try {
      await addTicketMessage(id, {
        body: replyBody.trim(),
        isInternal: superAdmin ? replyIsInternal : false,
        attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
      });

      setReplyBody("");
      setReplyAttachments([]);
      setReplyIsInternal(false);
      await fetchTicketDetails(true);
    } catch (err: any) {
      console.error("Failed to post message:", err);
      if (err?.code === "MESSAGE_LIMIT" || err?.status === 409) {
        setReplyError(t("support.errors.messageLimit"));
      } else if (err?.status === 429) {
        setReplyError(t("support.errors.rateLimited"));
      } else {
        setReplyError(err?.message || t("support.errors.messageSendFailed"));
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!id) return;
    setConfirming(true);
    setGeneralError(null);

    try {
      await confirmTicketResolution(id);
      setToastMessage(t("support.ticket.confirmedToast"));
      await fetchTicketDetails(true);
    } catch (err: any) {
      console.error("Failed to confirm ticket:", err);
      if (err?.code === "INVALID_TRANSITION") {
        setGeneralError(t("support.errors.invalidTransition"));
        fetchTicketDetails(true);
      } else if (err?.status === 429) {
        setGeneralError(t("support.errors.rateLimited"));
      } else {
        setGeneralError(err?.message || t("support.errors.updateFailed"));
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!id) return;
    setReopening(true);
    setGeneralError(null);

    try {
      await reopenTicket(id, reopenReason.trim() ? reopenReason.trim() : undefined);
      setShowReopenInput(false);
      setReopenReason("");
      setToastMessage(t("support.ticket.reopenedToast"));
      await fetchTicketDetails(true);
    } catch (err: any) {
      console.error("Failed to reopen ticket:", err);
      if (err?.code === "REOPEN_WINDOW_EXPIRED") {
        setGeneralError(t("support.errors.reopenWindowExpired"));
      } else if (err?.code === "INVALID_TRANSITION") {
        setGeneralError(t("support.errors.invalidTransition"));
        fetchTicketDetails(true);
      } else if (err?.status === 429) {
        setGeneralError(t("support.errors.rateLimited"));
      } else {
        setGeneralError(err?.message || t("support.errors.updateFailed"));
      }
    } finally {
      setReopening(false);
    }
  };

  const handleSaveAgentPanel = async () => {
    if (!id) return;
    setSavingAgent(true);
    setAgentError(null);

    try {
      const effort = agentEffortHours.trim() ? parseFloat(agentEffortHours) : undefined;
      await patchTicket(id, {
        status: agentStatus,
        priority: agentPriority,
        effortHours: effort,
      });

      setToastMessage(t("support.ticket.agentSavedToast"));
      await fetchTicketDetails(true);
    } catch (err: any) {
      console.error("Failed to update ticket from agent panel:", err);
      if (err?.code === "INVALID_TRANSITION") {
        setAgentError(t("support.errors.invalidTransition"));
        fetchTicketDetails(true);
      } else if (err?.status === 429) {
        setAgentError(t("support.errors.rateLimited"));
      } else {
        setAgentError(err?.message || t("support.errors.updateFailed"));
      }
    } finally {
      setSavingAgent(false);
    }
  };

  const formatTicketNumber = (num: number): string => {
    return `SUP-${String(num).padStart(4, "0")}`;
  };

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

  // Check if link is same origin
  const isInternalUrl = (url?: string | null): boolean => {
    if (!url) return false;
    if (url.startsWith("/")) return true;
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <AppHeader title={t("support.ticket.loading")} />
        <div className="content-container" style={{ textAlign: "center", padding: "64px" }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>
            {t("support.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className="page-container">
        <AppHeader
          title={t("support.ticket.notFoundTitle")}
          actions={
            <button
              className="button secondary button-icon"
              onClick={() => navigate("/support")}
            >
              <ArrowLeft size={16} />
              <span>{t("support.backToList")}</span>
            </button>
          }
        />
        <div className="content-container">
          <div className="card" style={{ textAlign: "center", padding: "64px 20px" }}>
            <AlertCircle size={48} style={{ color: "var(--danger)", marginBottom: "16px" }} />
            <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
              {t("support.ticket.notFoundTitle")}
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
              {t("support.ticket.notFoundDesc")}
            </p>
            <button
              className="button primary support-not-found-btn"
              onClick={() => navigate("/support")}
            >
              {t("support.backToList")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(ticket.isOwner);
  const canReply = isOwner || superAdmin;

  return (
    <div className="page-container">
      <AppHeader
        title={`${formatTicketNumber(ticket.ticketNumber)}: ${ticket.title}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button secondary button-icon"
              onClick={() => fetchTicketDetails(true)}
              disabled={refreshing}
              title={t("support.ticket.refresh")}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              <span>{t("support.ticket.refresh")}</span>
            </button>
            <button
              type="button"
              className="button secondary button-icon"
              onClick={() => navigate("/support")}
            >
              <ArrowLeft size={16} />
              <span>{t("support.backToList")}</span>
            </button>
          </div>
        }
        statusMessage={toastMessage || generalError}
        statusType={generalError ? "error" : "success"}
      />

      <div className="content-container">
        {/* Ticket Header & Metadata Summary */}
        <div className="support-ticket-header-card">
          <div className="support-ticket-title-row">
            <div className="support-ticket-title-left">
              <span className="support-ticket-id">
                {formatTicketNumber(ticket.ticketNumber)}
              </span>
              <SupportTypeBadge type={ticket.type} />
            </div>
            <div className="support-ticket-status-pill">
              <SupportStatusBadge status={ticket.status} />
            </div>
          </div>

          <div className="support-ticket-meta-grid">
            <div className="support-meta-item">
              <span className="support-meta-label">{t("support.module")}</span>
              <span className="support-meta-value">{ticket.areaLabel}</span>
            </div>
            <div className="support-meta-item">
              <span className="support-meta-label">{t("support.ticket.urgency")}</span>
              <span className="support-meta-value">{t(`support.urgency.${ticket.urgency}`)}</span>
            </div>
            <div className="support-meta-item">
              <span className="support-meta-label">{t("support.raisedBy")}</span>
              <span className="support-meta-value">{ticket.requesterName || "User"}</span>
            </div>
            <div className="support-meta-item">
              <span className="support-meta-label">{t("support.ticket.openedOn")}</span>
              <span className="support-meta-value">{formatDate(ticket.createdAt)}</span>
            </div>
            {ticket.pageUrl && (
              <div className="support-meta-item">
                <span className="support-meta-label">{t("support.new.linkOfPage")}</span>
                <span className="support-meta-value">
                  {isInternalUrl(ticket.pageUrl) ? (
                    <a
                      href={ticket.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                      style={{ color: "var(--primary)", textDecoration: "underline" }}
                    >
                      <span>{ticket.pageUrl}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span>{ticket.pageUrl}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Resolution Confirmation and Closed Panel */}
        <SupportResolutionPanel
          status={ticket.status}
          isOwner={isOwner}
          closedAt={ticket.closedAt}
          confirming={confirming}
          reopening={reopening}
          showReopenInput={showReopenInput}
          onToggleShowReopenInput={() => setShowReopenInput(!showReopenInput)}
          reopenReason={reopenReason}
          onReopenReasonChange={setReopenReason}
          onConfirmResolution={handleConfirmResolution}
          onReopenTicket={handleReopenTicket}
          onRaiseNewTicket={() => navigate("/support/new")}
        />

        {/* Message Thread */}
        <SupportThread
          messages={messages}
          attachments={attachments}
          onDownloadAttachment={handleDownloadAttachment}
        />

        {/* Reply Box */}
        <SupportReplyBox
          canReply={canReply}
          isSuperAdmin={superAdmin}
          replyBody={replyBody}
          onReplyBodyChange={setReplyBody}
          onAttachmentsChange={setReplyAttachments}
          replyIsUploading={replyIsUploading}
          onUploadingChange={setReplyIsUploading}
          replyIsInternal={replyIsInternal}
          onReplyIsInternalChange={setReplyIsInternal}
          sendingReply={sendingReply}
          replyError={replyError}
          onSendReply={handleSendReply}
        />

        {/* Agent Panel (Superadmin Only) */}
        {superAdmin && (
          <SupportAgentPanel
            ticket={ticket}
            statusEvents={statusEvents}
            elapsedMinutes={elapsedMinutes}
            agentStatus={agentStatus}
            onAgentStatusChange={setAgentStatus}
            agentPriority={agentPriority}
            onAgentPriorityChange={setAgentPriority}
            agentEffortHours={agentEffortHours}
            onAgentEffortHoursChange={setAgentEffortHours}
            savingAgent={savingAgent}
            agentError={agentError}
            onSaveAgentPanel={handleSaveAgentPanel}
            getNextStatuses={getNextStatuses}
          />
        )}
      </div>
    </div>
  );
};

export { SupportTicketPage as SupportTicket };
