import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportResolutionPanel } from "./SupportResolutionPanel";
import { SupportThread } from "./SupportThread";
import { SupportReplyBox } from "./SupportReplyBox";
import { SupportAgentPanel } from "./SupportAgentPanel";
import { SupportTicketHeaderCard } from "./SupportTicketHeaderCard";
import { useSupportTicket } from "./useSupportTicket";
import { useSupportTicketActions } from "./useSupportTicketActions";
import { formatTicketNumber, getNextStatuses } from "./supportTicketHelpers";
import { isSuperAdmin } from "../../lib/auth";
import "../../styles/pages/Support.css";

export const SupportTicketPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const superAdmin = isSuperAdmin(user);

  const {
    ticket,
    messages,
    attachments,
    statusEvents,
    elapsedMinutes,
    loading,
    refreshing,
    notFound,
    generalError,
    setGeneralError,
    toastMessage,
    setToastMessage,
    agentStatus,
    setAgentStatus,
    agentPriority,
    setAgentPriority,
    agentEffortHours,
    setAgentEffortHours,
    fetchTicketDetails,
    handleDownloadAttachment,
  } = useSupportTicket(id);

  const {
    replyBody,
    setReplyBody,
    setReplyAttachments,
    replyIsUploading,
    setReplyIsUploading,
    replyIsInternal,
    setReplyIsInternal,
    sendingReply,
    replyError,
    showReopenInput,
    setShowReopenInput,
    reopenReason,
    setReopenReason,
    reopening,
    confirming,
    savingAgent,
    agentError,
    handleSendReply,
    handleConfirmResolution,
    handleReopenTicket,
    handleSaveAgentPanel,
  } = useSupportTicketActions({
    id,
    superAdmin,
    fetchTicketDetails,
    setGeneralError,
    setToastMessage,
    agentStatus,
    agentPriority,
    agentEffortHours,
  });

  if (loading) {
    return (
      <div className="page-container">
        <AppHeader title={t("support.ticket.loading")} />
        <div
          className="content-container"
          style={{ textAlign: "center", padding: "64px" }}
        >
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
          <div
            className="card"
            style={{ textAlign: "center", padding: "64px 20px" }}
          >
            <AlertCircle
              size={48}
              style={{ color: "var(--danger)", marginBottom: "16px" }}
            />
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
        <SupportTicketHeaderCard ticket={ticket} />

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
