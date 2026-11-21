import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, AlertCircle, LifeBuoy } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { getTickets } from "../../services/api/support";
import { SupportTicket, SupportTicketStatus } from "../../types/support";
import { Pagination } from "../../components/Pagination";
import type { PaginationInfo } from "../../hooks/usePagination";
import { SupportListTable } from "./SupportListTable";
import { isSuperAdmin, hasAnyExactAccessRole } from "../../lib/auth";
import { SUPPORT_SHARED_VIEW_ROLES } from "../../constants/accessControl";
import "../../styles/components/CommonTable.css";
import "../../styles/pages/Support.css";

export const SupportList: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const superAdmin = isSuperAdmin(user);
  const canViewShared =
    superAdmin || hasAnyExactAccessRole(user, SUPPORT_SHARED_VIEW_ROLES);

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
  }, [
    canViewShared,
    scope,
    statusFilter,
    pagination.page,
    pagination.limit,
    t,
  ]);

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

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
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
              <div
                className="support-scope-toggle"
                role="group"
                aria-label="Ticket view scope"
              >
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
              <label
                htmlFor="support-status-filter"
                className="support-filter-label"
              >
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
                <option value="in_progress">
                  {t("support.status.in_progress")}
                </option>
                <option value="waiting_on_client">
                  {t("support.filterWaitingOnYou")}
                </option>
                <option value="resolved">{t("support.filterFixed")}</option>
                <option value="closed">{t("support.status.closed")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            className="error-message mb-4 flex items-center gap-2"
            role="alert"
          >
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
              <LifeBuoy
                size={48}
                style={{ color: "var(--text-muted)", marginBottom: "16px" }}
              />
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "8px",
                  color: "var(--text)",
                }}
              >
                {t("support.emptyTitle")}
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  maxWidth: "420px",
                  margin: "0 auto 24px",
                }}
              >
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
              <SupportListTable
                tickets={tickets}
                scope={scope}
                onOpen={navigate}
              />

              {/* Pagination Controls */}
              <Pagination
                position="bottom"
                pagination={pagination}
                onPageChange={handlePageChange}
                labels={{
                  pageInfo: t("support.paginationPage")
                    .replace("{page}", String(pagination.page))
                    .replace("{totalPages}", String(pagination.totalPages)),
                  previous: t("support.paginationPrevious"),
                  previousTitle: t("support.paginationPrevious"),
                  next: t("support.paginationNext"),
                  nextTitle: t("support.paginationNext"),
                  goToPage: t("support.paginationGoToPage"),
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
