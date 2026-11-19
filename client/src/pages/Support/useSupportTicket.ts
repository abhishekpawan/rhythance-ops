import { useState, useEffect, useCallback } from "react";
import {
  getTicketById,
  getAttachmentDownloadUrl,
} from "../../services/api/support";
import {
  SupportTicket,
  SupportMessage,
  SupportAttachment,
  SupportStatusEvent,
  SupportTicketStatus,
  SupportTicketPriority,
} from "../../types/support";
import { useLanguage } from "../../contexts/language/language-provider";

export const useSupportTicket = (id: string | undefined) => {
  const { t } = useLanguage();

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

  // Agent panel form state
  const [agentStatus, setAgentStatus] = useState<SupportTicketStatus>("open");
  const [agentPriority, setAgentPriority] =
    useState<SupportTicketPriority>("p3");
  const [agentEffortHours, setAgentEffortHours] = useState<string>("");

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
            (data.ticket.effortMinutes != null
              ? data.ticket.effortMinutes
              : undefined)
        );

        // Pre-fill agent controls
        setAgentStatus(data.ticket.status);
        setAgentPriority(data.ticket.priority || "p3");
        if (
          data.ticket.effortMinutes !== undefined &&
          data.ticket.effortMinutes !== null
        ) {
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

  const handleDownloadAttachment = async (attId: string) => {
    try {
      const url = await getAttachmentDownloadUrl(attId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error("Failed to download attachment:", err);
      alert(
        t("support.errors.downloadFailed") || "Failed to download attachment"
      );
    }
  };

  return {
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
  };
};
