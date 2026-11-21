import { useEffect, useState } from "react";
import {
  EnhancedCalendarSummary,
  getCalendarSummary,
  getCalendarSummaryForToday,
  getCalendarSummaryForWeek,
  getCalendarSummaryForMonth,
} from "../../services/api/calendar";
import { useLanguage } from "../../contexts/language/language-provider";

export type QuickFilterType = "today" | "week" | "month" | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface CalendarSummaryOptions {
  clientId?: string;
  jobseekerId?: string;
  initialDateRange?: DateRange;
}

/** The summary of the calendar's widgets: what is asked of the server, for which period, and the numbers shown. */
export function useCalendarSummary({
  clientId,
  jobseekerId,
  initialDateRange,
}: CalendarSummaryOptions) {
  const { t } = useLanguage();

  // State management
  const [summary, setSummary] = useState<EnhancedCalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange>(
    initialDateRange || {
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    }
  );

  // Helper functions
  const formatDateRange = () => {
    if (!summary?.dateRange) return t("calendar.loading");

    const start = new Date(summary.dateRange.startDate);
    const end = new Date(summary.dateRange.endDate);

    // If same date, show only one date
    if (summary.dateRange.startDate === summary.dateRange.endDate) {
      return start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const startStr = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const endStr = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startStr} - ${endStr}`;
  };

  const calculateCompletionRate = () => {
    if (!summary || summary.totalPositions === 0) return 0;
    return summary.fillRate;
  };

  // Data fetching function
  const fetchSummary = async (
    filterType: QuickFilterType,
    dateRange?: DateRange
  ) => {
    try {
      setLoading(true);
      setError(null);

      let summaryData: EnhancedCalendarSummary;

      switch (filterType) {
        case "today":
          summaryData = await getCalendarSummaryForToday(clientId, jobseekerId);
          break;
        case "week":
          summaryData = await getCalendarSummaryForWeek(
            new Date(),
            clientId,
            jobseekerId
          );
          break;
        case "month":
          summaryData = await getCalendarSummaryForMonth(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            clientId,
            jobseekerId
          );
          break;
        case "custom":
          if (!dateRange)
            throw new Error("Date range required for custom filter");
          summaryData = await getCalendarSummary({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            clientId,
            jobseekerId,
          });
          break;
        default:
          throw new Error("Invalid filter type");
      }

      setSummary(summaryData);
    } catch (err) {
      console.error("Error fetching calendar summary:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch summary");
    } finally {
      setLoading(false);
    }
  };

  // Handle quick filter changes
  const handleQuickFilter = (filterType: QuickFilterType) => {
    setActiveFilter(filterType);
    fetchSummary(filterType);
  };

  // Handle custom date range application
  const handleApplyDateRange = () => {
    setActiveFilter("custom");
    fetchSummary("custom", customDateRange);
  };

  // Effect to load initial data
  useEffect(() => {
    if (initialDateRange) {
      setActiveFilter("custom");
      fetchSummary("custom", initialDateRange);
    } else {
      fetchSummary("month");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, jobseekerId]);

  // Update custom date range when initialDateRange changes
  useEffect(() => {
    if (initialDateRange) {
      setCustomDateRange(initialDateRange);
    }
  }, [initialDateRange]);

  return {
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
  };
}
