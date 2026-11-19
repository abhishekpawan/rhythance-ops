import React, { useState } from "react";
import {
  addTicketMessage,
  confirmTicketResolution,
  reopenTicket,
  patchTicket,
} from "../../services/api/support";
import {
  SupportTicketStatus,
  SupportTicketPriority,
  CreateAttachmentInput,
} from "../../types/support";
import { useLanguage } from "../../contexts/language/language-provider";

interface SupportTicketActionsArgs {
  id: string | undefined;
  superAdmin: boolean;
  fetchTicketDetails: (isManualRefresh?: boolean) => Promise<void>;
  setGeneralError: (message: string | null) => void;
  setToastMessage: (message: string | null) => void;
  agentStatus: SupportTicketStatus;
  agentPriority: SupportTicketPriority;
  agentEffortHours: string;
}

export const useSupportTicketActions = ({
  id,
  superAdmin,
  fetchTicketDetails,
  setGeneralError,
  setToastMessage,
  agentStatus,
  agentPriority,
  agentEffortHours,
}: SupportTicketActionsArgs) => {
  const { t } = useLanguage();

  // Reply state
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<
    CreateAttachmentInput[]
  >([]);
  const [replyIsUploading, setReplyIsUploading] = useState(false);
  const [replyIsInternal, setReplyIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Reopen modal/box state
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [savingAgent, setSavingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

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
      await reopenTicket(
        id,
        reopenReason.trim() ? reopenReason.trim() : undefined
      );
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
      const effort = agentEffortHours.trim()
        ? parseFloat(agentEffortHours)
        : undefined;
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

  return {
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
  };
};
