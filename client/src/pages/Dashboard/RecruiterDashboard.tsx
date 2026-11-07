import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { AppHeader } from "../../components/AppHeader";
import { UserRoleBadges } from "../../components/dashboard/UserRoleBadges";
import { formatDateTimeCanada } from "../../utils/dateUtils";
import { MetricData } from "../../components/dashboard/types";
import { useRecentActivities } from "../../hooks/useRecentActivities";
import "../../styles/components/header.css";
import "../../styles/pages/Dashboard.css";
import { RecentActivities } from "../../components/dashboard/RecentActivities";
import { useLanguage } from "../../contexts/language/language-provider";
import { ExpiryStatusOverview } from "../../components/dashboard/ExpiryStatusOverview";
import { getCacheKey } from "./shared/metricTransforms";
import {
  useBasicAIInsights,
  useExpandedGraphs,
  useMetricsFetch,
} from "./shared/useDashboardMetrics";
import { DataViewToggle, MetricGrid } from "./shared/DashboardWidgets";
import { AIInsightsSection, ClientMetricCard } from "./shared/DashboardSections";

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
}

type MetricsHook = ReturnType<typeof useMetricsFetch>;

export function RecruiterDashboard() {
  const { user, isRecruiter } = useAuth();
  const { t } = useLanguage();
  const [userData, setUserData] = useState<UserData | null>(null);
  const { expandedGraphs, handleToggleGraph } = useExpandedGraphs();

  // "Show all" switches: the recruiter's own data, or every recruiter's
  const [showAllRecruiters, setShowAllRecruiters] = useState(false);
  const [showAllRecruitersClients, setShowAllRecruitersClients] = useState(false);
  const [showAllRecruitersPositions, setShowAllRecruitersPositions] = useState(false);

  // Real-time activities hook
  const {
    activities,
    isConnected,
    error: activitiesError,
    isLoading: activitiesLoading,
    isLoadingMore: activitiesLoadingMore,
    hasMore: activitiesHasMore,
    retry: retryActivities,
    loadMore: loadMoreActivities,
  } = useRecentActivities({
    limit: 10,
    enabled: true,
  });

  const userId = userData?.id || null;
  const recruiterMetrics = useMetricsFetch(userId, showAllRecruiters, "metrics");
  const clientMetrics = useMetricsFetch(userId, showAllRecruitersClients, "clients");
  const positionMetrics = useMetricsFetch(userId, showAllRecruitersPositions, "positions");
  const aiMetrics = useMetricsFetch(null, false, "aiInsights");
  const basicAiInsights = useBasicAIInsights();

  const toggleDescriptions = useMemo(
    () => ({
      recruiter: showAllRecruiters
        ? t("dashboard.viewingAggregatedData")
        : t("dashboard.viewingPersonalMetrics"),
      client: showAllRecruitersClients
        ? t("dashboard.viewingClientData")
        : t("dashboard.viewingPersonalClientMetrics"),
      position: showAllRecruitersPositions
        ? t("dashboard.viewingPositionData")
        : t("dashboard.viewingPersonalPositionMetrics"),
    }),
    [showAllRecruiters, showAllRecruitersClients, showAllRecruitersPositions, t]
  );

  const handleMetricClick = useCallback((metric: MetricData) => {
    console.log("Metric clicked:", metric.label);
  }, []);

  /** Flips one "Show all" switch: clears both cache entries, then refetches. */
  const createToggleHandler = useCallback(
    (
      cacheType: "metrics" | "clients" | "positions",
      currentState: boolean,
      setShowAll: (value: boolean) => void,
      metrics: MetricsHook
    ) =>
      () => {
        const newState = !currentState;
        setShowAll(newState);
        metrics.resetToLoading();

        if (userData?.id) {
          metrics.clearCache(getCacheKey(cacheType, currentState, userData.id));
          metrics.clearCache(getCacheKey(cacheType, newState, userData.id));
          metrics.fetchData(newState);
        }
      },
    [userData?.id]
  );

  const handleToggleView = createToggleHandler(
    "metrics",
    showAllRecruiters,
    setShowAllRecruiters,
    recruiterMetrics
  );
  const handleToggleClientView = createToggleHandler(
    "clients",
    showAllRecruitersClients,
    setShowAllRecruitersClients,
    clientMetrics
  );
  const handleTogglePositionView = createToggleHandler(
    "positions",
    showAllRecruitersPositions,
    setShowAllRecruitersPositions,
    positionMetrics
  );

  // Initialize user data
  useEffect(() => {
    if (user && isRecruiter) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || t("common.user"),
        userType: user.user_metadata?.user_type || "recruiter",
        createdAt: formatDateTimeCanada(user.created_at, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        lastSignIn: user.last_sign_in_at
          ? formatDateTimeCanada(user.last_sign_in_at)
          : t("dashboard.firstLogin"),
      });
    }
  }, [user, isRecruiter, t]);

  // Fetch initial data when userData is available
  useEffect(() => {
    if (userData?.id) {
      recruiterMetrics.fetchData();
      clientMetrics.fetchData();
      positionMetrics.fetchData();
      aiMetrics.fetchData();
      basicAiInsights.fetchData();
    }
  }, [
    userData?.id,
    recruiterMetrics.fetchData,
    clientMetrics.fetchData,
    positionMetrics.fetchData,
    aiMetrics.fetchData,
    basicAiInsights.fetchData,
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      recruiterMetrics.clearCache();
      clientMetrics.clearCache();
      positionMetrics.clearCache();
      aiMetrics.clearCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!userData) {
    return (
      <div className="centered-container">
        <span className="loading-spinner"></span>
      </div>
    );
  }

  const gridHandlers = {
    expandedGraphs,
    onMetricClick: handleMetricClick,
    onToggleGraph: handleToggleGraph,
  };

  return (
    <div className="dashboard-container">
      <AppHeader title={t("dashboard.welcome")} showCompanySwitcher={true} />

      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">
            {t("welcome")}, {userData.name}!
          </h1>
          <UserRoleBadges />
        </div>
        <p className="dashboard-subtitle">{t("recruiter_subtitle")}</p>

        <div className="dashboard-grid">
          <div className="dashboard-left-side">
            <div className="metrics-grid-container">
              <DataViewToggle
                id="recruiterDataToggle"
                checked={showAllRecruiters}
                onChange={handleToggleView}
                label={toggleDescriptions.recruiter}
                description={t("dashboard.toggleDataView")}
              />
              <MetricGrid
                {...gridHandlers}
                metricsState={recruiterMetrics.state}
                onRetry={recruiterMetrics.retry}
                gridSize={4}
                size="sm"
                redirectToValue="/jobseeker-management"
              />
            </div>
          </div>

          {/* Recent Activities */}
          <div className="dashboard-right-side">
            <RecentActivities
              activities={activities}
              isConnected={isConnected}
              error={activitiesError}
              isLoading={activitiesLoading}
              isLoadingMore={activitiesLoadingMore}
              hasMore={activitiesHasMore}
              onRetry={retryActivities}
              onLoadMore={loadMoreActivities}
            />
          </div>
        </div>
        {/* Document Expiry Status Overview */}
        <ExpiryStatusOverview />
        {/* Position Metrics */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="positionDataToggle"
            checked={showAllRecruitersPositions}
            onChange={handleTogglePositionView}
            label={toggleDescriptions.position}
            description={t("dashboard.togglePositionDataView")}
          />

          <div className="position-metrics-grid">
            <MetricGrid
              {...gridHandlers}
              metricsState={positionMetrics.state}
              onRetry={positionMetrics.retry}
              gridSize={3}
              size="sm"
              className="position-metrics"
              redirectToValue="/position-management"
            />
          </div>
        </div>

        {/* AI Insights */}
        <AIInsightsSection
          {...gridHandlers}
          aiMetrics={aiMetrics}
          basicAiInsights={basicAiInsights}
        />

        {/* Client Metrics */}
        <div className="client-metrics-container">
          <DataViewToggle
            id="clientDataToggle"
            checked={showAllRecruitersClients}
            onChange={handleToggleClientView}
            label={toggleDescriptions.client}
            description={t("dashboard.toggleClientDataView")}
          />
          <ClientMetricCard
            clientMetrics={clientMetrics}
            onMetricClick={handleMetricClick}
            onToggleGraph={handleToggleGraph}
          />
        </div>
      </main>
    </div>
  );
}
