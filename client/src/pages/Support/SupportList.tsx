import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, AlertCircle, LifeBuoy } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { getTickets } from "../../services/api/support";
import { SupportTicket, SupportTicketStatus } from "../../types/support";
import { SupportStatusBadge } from "./SupportStatusBadge";
import { SupportTypeBadge } from "./SupportTypeBadge";
import { isSuperAdmin, hasAnyExactAccessRole } from "../../lib/auth";
import { SUPPORT_SHARED_VIEW_ROLES } from "../../constants/accessControl";
import "../../styles/components/CommonTable.css";
import "../../styles/pages/Support.css";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const SupportList: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const superAdmin = isSuperAdmin(user);
  const canViewShared = superAdmin || hasAnyExactAccessRole(user, SUPPORT_SHARED_VIEW_ROLES);

  // Default scope: defaults to 'mine' for all users
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(
    (location.state as { message?: string })?.message || null
  );

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Clear toast message after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchTicketList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getTickets({
        scope: canViewShared ? scope : "mine",
        status: (statusFilter as SupportTicketStatus) || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      setTickets(res.tickets);
      setPagination(res.pagination);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError(t("support.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [canViewShared, scope, statusFilter, pagination.page, pagination.limit, t]);

  useEffect(() => {
    fetchTicketList();
  }, [fetchTicketList]);

  const handleScopeChange = (newScope: "mine" | "all") => {
    setScope(newScope);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

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

  return (
    <div className="page-container">
      <AppHeader
        title={t("support.title")}
        actions={
          <button
            className="button primary button-icon support-raise-btn"
            onClick={() => navigate("/support/new")}
          >
            <Plus size={16} />
            <span>{t("support.raiseTicket")}</span>
          </button>
        }
        statusMessage={toastMessage || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {/* Toolbar: Scope toggle & status filter */}
        <div className="support-toolbar">
          <div className="support-toolbar-left">
            {canViewShared && (
              <div className="support-scope-toggle" role="group" aria-label="Ticket view scope">
                <button
                  type="button"
                  className={`support-scope-btn ${scope === "mine" ? "active" : ""}`}
                  onClick={() => handleScopeChange("mine")}
                >
                  {t("support.myTickets")}
                </button>
                <button
                  type="button"
                  className={`support-scope-btn ${scope === "all" ? "active" : ""}`}
                  onClick={() => handleScopeChange("all")}
                >
                  {t("support.allTickets")}
                </button>
              </div>
            )}

            <div className="support-filter-group">
              <label htmlFor="support-status-filter" className="support-filter-label">
                {t("support.filterStatus")}:
              </label>
              <select
                id="support-status-filter"
                className="support-filter-select"
                value={statusFilter}
                onChange={handleStatusChange}
              >
                <option value="">{t("support.statusAll")}</option>
                <option value="open">{t("support.status.open")}</option>
                <option value="in_progress">{t("support.status.in_progress")}</option>
                <option value="waiting_on_client">{t("support.filterWaitingOnYou")}</option>
                <option value="resolved">{t("support.filterFixed")}</option>
                <option value="closed">{t("support.status.closed")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="error-message mb-4 flex items-center gap-2" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Card containing Table */}
        <div className="card">
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px" }}>
              <div className="loading-spinner" />
              <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>
                {t("support.loading")}
              </p>
            </div>
          ) : tickets.length === 0 ? (
            /* Friendly Empty State */
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <LifeBuoy size={48} style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
              <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "var(--text)" }}>
                {t("support.emptyTitle")}
              </h3>
              <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 24px" }}>
                {t("support.emptyDesc")}
              </p>
              <button
                className="button primary button-icon support-raise-btn"
                onClick={() => navigate("/support/new")}
              >
                <Plus size={16} />
                <span>{t("support.raiseTicket")}</span>
              </button>
            </div>
          ) : (
            <>
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
                        onClick={() => navigate(`/support/${ticket.id}`)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/support/${ticket.id}`);
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
                        <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                          {formatDate(ticket.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="pagination-controls bottom">
                  <div className="pagination-info">
                    <span className="pagination-text">
                      {t("support.paginationPage")
                        .replace("{page}", String(pagination.page))
                        .replace("{totalPages}", String(pagination.totalPages))}
                    </span>
                  </div>
                  <div className="pagination-buttons">
                    <button
                      className="pagination-btn prev"
                      onClick={handlePreviousPage}
                      disabled={!pagination.hasPrevPage}
                      title={t("support.paginationPrevious")}
                      aria-label={t("support.paginationPrevious")}
                    >
                      <ChevronLeft size={16} />
                      <span>{t("support.paginationPrevious")}</span>
                    </button>

                    <div className="page-numbers">
                      {Array.from(
                        { length: Math.min(5, pagination.totalPages) },
                        (_, i) => {
                          let pageNum: number;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.page <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.page >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.page - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              className={`page-number-btn ${
                                pageNum === pagination.page ? "active" : ""
                              }`}
                              onClick={() => handlePageChange(pageNum)}
                              aria-label={`Go to page ${pageNum}`}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <button
                      className="pagination-btn next"
                      onClick={handleNextPage}
                      disabled={!pagination.hasNextPage}
                      title={t("support.paginationNext")}
                      aria-label={t("support.paginationNext")}
                    >
                      <span>{t("support.paginationNext")}</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
