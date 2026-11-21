import { useLanguage } from "../../contexts/language/language-provider";
import { Users, Briefcase, CheckCircle, Clock, Calendar } from "lucide-react";
import { SummaryWidgetsSkeleton } from "./SummaryWidgetsSkeleton";
import { useCalendarSummary, type DateRange } from "./useCalendarSummary";
import "./SummaryWidgets.css";

interface SummaryWidgetsProps {
  clientId?: string;
  jobseekerId?: string;
  initialDateRange?: DateRange;
}

export function SummaryWidgets({
  clientId,
  jobseekerId,
  initialDateRange,
}: SummaryWidgetsProps) {
  const { t } = useLanguage();
  const {
    summary,
    loading,
    error,
    activeFilter,
    customDateRange,
    setCustomDateRange,
    fetchSummary,
    handleQuickFilter,
    handleApplyDateRange,
    formatDateRange,
    calculateCompletionRate,
  } = useCalendarSummary({ clientId, jobseekerId, initialDateRange });

  // Error state
  if (error) {
    return (
      <div className="summary-widgets">
        <div className="summary-header">
          <h3 className="summary-title">{t("calendar.summaryOverview")}</h3>
          <div className="summary-error">
            <span>{error}</span>
            <button
              className="retry-button"
              onClick={() =>
                fetchSummary(
                  activeFilter,
                  activeFilter === "custom" ? customDateRange : undefined
                )
              }
            >
              {t("calendar.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return <SummaryWidgetsSkeleton />;
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="summary-widgets">
      <div className="summary-header">
        <div className="header-left">
          <h3 className="summary-title">{t("calendar.summaryOverview")}</h3>
        </div>

        <div className="header-right">
          <div className="filter-controls">
            {/* Quick Filter Buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-button ${activeFilter === "today" ? "active" : ""}`}
                onClick={() => handleQuickFilter("today")}
              >
                {t("calendar.today")}
              </button>
              <button
                className={`filter-button ${activeFilter === "week" ? "active" : ""}`}
                onClick={() => handleQuickFilter("week")}
              >
                {t("calendar.thisWeekLabel")}
              </button>
              <button
                className={`filter-button ${activeFilter === "month" ? "active" : ""}`}
                onClick={() => handleQuickFilter("month")}
              >
                {t("calendar.thisMonthLabel")}
              </button>
            </div>

            {/* Inline Date Range Inputs */}
            <div className="date-range-inputs">
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="date-input"
                title={t("calendar.from")}
              />
              <span className="date-separator">-</span>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="date-input"
                title={t("calendar.to")}
              />
              <button
                className="apply-date-button"
                onClick={handleApplyDateRange}
              >
                <Calendar size={14} />
                {t("calendar.apply")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="widgets-grid">
        {/* Total Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon positions">
            <Briefcase size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">{t("calendar.totalPositions")}</span>
            <span className="widget-value">{summary.totalPositions}</span>
          </div>
        </div>

        {/* Total Filled Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon assignments">
            <CheckCircle size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">
              {t("calendar.totalFilledPositions")}
            </span>
            <span className="widget-value">{summary.activeAssignments}</span>
          </div>
        </div>

        {/* Total Available Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon jobseekers">
            <Users size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">
              {t("calendar.totalAvailablePositions")}
            </span>
            <span className="widget-value">{summary.availablePositions}</span>
          </div>
        </div>

        {/* Completion Rate Widget */}
        <div className="summary-widget">
          <div className="widget-icon completion">
            <Clock size={20} />
          </div>
          <div className="widget-content completion-widget">
            <div className="widget-content-row">
              <span className="widget-label">
                {t("calendar.completionRate")}
              </span>
              <span className="widget-value">{calculateCompletionRate()}%</span>
            </div>
            <div className="progress-bar summary-progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${calculateCompletionRate()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="summary-insights">
        <div className="insight-item">
          <span className="insight-label">{t("calendar.openPositions")}:</span>
          <span className="insight-value">{summary.availablePositions}</span>
        </div>

        <div className="insight-item">
          <span className="insight-label">{t("calendar.fillRate")}:</span>
          <span className="insight-value">{summary.fillRate}%</span>
        </div>

        <div className="insight-item">
          <span className="insight-label">{t("calendar.summaryPeriod")}:</span>
          <span className="insight-value">{formatDateRange()}</span>
        </div>
      </div>

      {/* Status Breakdown */}
      {/* {summary.statusBreakdown && (
        <div className="status-breakdown">
          <h4 className="breakdown-title">{t('calendar.statusBreakdown')}</h4>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">{t('calendar.active')}:</span>
              <span className="status-value">{summary.statusBreakdown.active}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.upcoming')}:</span>
              <span className="status-value">{summary.statusBreakdown.upcoming}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.completed')}:</span>
              <span className="status-value">{summary.statusBreakdown.completed}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.cancelled')}:</span>
              <span className="status-value">{summary.statusBreakdown.cancelled}</span>
            </div>
          </div>
        </div>
      )} */}

      {/* Status Indicators */}
      {/* <div className="status-indicators">
        <div className={`status-indicator ${summary.totalPositions > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.positionsAvailable')}</span>
        </div>
        
        <div className={`status-indicator ${summary.activeAssignments > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.assignmentsActive')}</span>
        </div>
        
        <div className={`status-indicator ${summary.totalJobseekers > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.jobseekersEngaged')}</span>
        </div>
      </div> */}
    </div>
  );
}
