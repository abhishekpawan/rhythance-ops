/**
 * Dashboard sections that are identical on the admin and recruiter dashboards.
 */
import { MetricCard } from "../../../components/dashboard/MetricCard";
import { MetricData } from "../../../components/dashboard/types";
import { type AIInsightsResponse } from "../../../services/api/aiInsights";
import { useLanguage } from "../../../contexts/language/language-provider";
import { AISummary, MetricGrid } from "./DashboardWidgets";
import { MetricsState } from "./metricConfig";

interface CommonProps {
  expandedGraphs: Set<string>;
  onMetricClick: (metric: MetricData) => void;
  onToggleGraph: (show: boolean, metricId?: string) => void;
}

interface AIInsightsSectionProps extends CommonProps {
  aiMetrics: { state: MetricsState; retry: () => void };
  basicAiInsights: {
    state: {
      data: AIInsightsResponse | null;
      loading: boolean;
      error: string | null;
    };
    retry: () => void;
  };
}

/** AI activity cards plus the two headline AI numbers beside them. */
export function AIInsightsSection({
  aiMetrics,
  basicAiInsights,
  expandedGraphs,
  onMetricClick,
  onToggleGraph,
}: AIInsightsSectionProps) {
  const { t } = useLanguage();

  return (
    <div className="dashboard-grid ai-insights">
      <div className="ai-insights-container">
        <div className="ai-insights-header">
          <h3 className="ai-insights-title">
            {t("dashboard.aiActivityInsights")}
          </h3>
          <p className="ai-insights-description">
            {t("dashboard.aiActivityDescription")}
          </p>
        </div>

        <div className="ai-insights-grid">
          <MetricGrid
            metricsState={aiMetrics.state}
            expandedGraphs={expandedGraphs}
            onMetricClick={onMetricClick}
            onToggleGraph={onToggleGraph}
            onRetry={aiMetrics.retry}
            gridSize={2}
            size="sm"
            className="ai-insights"
          />
        </div>
      </div>

      <div className="ai-summary-container">
        <AISummary
          basicAiInsights={basicAiInsights.state.data}
          loading={basicAiInsights.state.loading}
          error={basicAiInsights.state.error}
          onRetry={basicAiInsights.retry}
        />
      </div>
    </div>
  );
}

interface ClientMetricCardProps extends Omit<CommonProps, "expandedGraphs"> {
  clientMetrics: { state: MetricsState; retry: () => void };
}

/** The wide "Total Clients Created" card with its chart always open. */
export function ClientMetricCard({
  clientMetrics,
  onMetricClick,
  onToggleGraph,
}: ClientMetricCardProps) {
  const { t } = useLanguage();
  const { state } = clientMetrics;

  return (
    <MetricCard
      data={
        state.data[0] || {
          id: "total_clients",
          label: t("dashboard.totalClientsCreated"),
          currentValue: 0,
          previousValue: 0,
          historicalData: [],
        }
      }
      size="md"
      layout="horizontal"
      showGraph={true}
      onClick={onMetricClick}
      onToggleGraph={(show) =>
        onToggleGraph(show, state.data[0]?.id || "total_clients")
      }
      loading={state.loading || state.data.length === 0}
      error={state.error}
      onRetry={clientMetrics.retry}
      redirectTo="/client-management"
    />
  );
}
