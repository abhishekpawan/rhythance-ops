import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { AppHeader } from "../../components/AppHeader";
import { UserRoleBadges } from "../../components/dashboard/UserRoleBadges";
import { formatDateTimeCanada } from "../../utils/dateUtils";
import { MetricData } from "../../components/dashboard/types";
import { useRecentActivities } from "../../hooks/useRecentActivities";
import { RecentActivities } from "../../components/dashboard/RecentActivities";
import { ExpiryStatusOverview } from "../../components/dashboard/ExpiryStatusOverview";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  useBasicAIInsights,
  useExpandedGraphs,
  useMetricsFetch,
} from "./shared/useDashboardMetrics";
import { DataViewToggle, MetricGrid } from "./shared/DashboardWidgets";
import { AIInsightsSection, ClientMetricCard } from "./shared/DashboardSections";
import {
  useInvoiceMetrics,
  useTimesheetMetrics,
} from "./shared/useOperationsMetrics";

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
}

export function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [userData, setUserData] = useState<UserData | null>(null);
  const { expandedGraphs, handleToggleGraph } = useExpandedGraphs();

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

  // Admins always see every recruiter's data.
  const userId = userData?.id || null;
  const recruiterMetrics = useMetricsFetch(userId, true, "metrics");
  const clientMetrics = useMetricsFetch(userId, true, "clients");
  const positionMetrics = useMetricsFetch(userId, true, "positions");
  const aiMetrics = useMetricsFetch(null, true, "aiInsights");
  const basicAiInsights = useBasicAIInsights();
  const timesheets = useTimesheetMetrics(Boolean(userData?.id));
  const invoices = useInvoiceMetrics(Boolean(userData?.id));

  const toggleDescriptions = useMemo(
    () => ({
      recruiter: t("dashboard.viewingTotalJobseekerMetrics"),
      client: t("dashboard.viewingTotalClientMetrics"),
      position: t("dashboard.viewingTotalPositionMetrics"),
      timesheet: t("dashboard.viewingTotalTimesheetMetrics"),
      invoice: t("dashboard.viewingTotalInvoiceMetrics"),
    }),
    [t]
  );

  const handleMetricClick = useCallback((metric: MetricData) => {
    console.log("Metric clicked:", metric.label);
  }, []);

  // Initialize user data
  useEffect(() => {
    if (user && isAdmin) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || t("common.user"),
        userType: user.user_metadata?.user_type || "admin",
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
  }, [user, isAdmin, t]);

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
            {t("welcome")}, {userData?.name}!
          </h1>
          <UserRoleBadges />
        </div>
        <p className="dashboard-subtitle">{t("admin_subtitle")}</p>

        <div className="dashboard-grid">
          {/* Jobseeker Metrics Section */}
          <div className="dashboard-left-side">
            <div className="metrics-grid-container">
              <DataViewToggle
                id="recruiterDataToggle"
                labelAs="h1"
                label={toggleDescriptions.recruiter}
                description={t("dashboard.toggleAllRecruitersData")}
              />
              <MetricGrid
                {...gridHandlers}
                growWithData
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
            labelAs="h1"
            label={toggleDescriptions.position}
            description={t("dashboard.toggleAllRecruitersPositionData")}
          />

          <div className="position-metrics-grid">
            <MetricGrid
              {...gridHandlers}
              growWithData
              metricsState={positionMetrics.state}
              onRetry={positionMetrics.retry}
              gridSize={3}
              size="sm"
              className="position-metrics"
              redirectToValue="/position-management"
            />
          </div>
        </div>

        {/* Invoice Metrics */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="invoiceDataToggle"
            labelAs="h1"
            label={toggleDescriptions.invoice}
            description={t("dashboard.toggleAllRecruitersInvoiceData")}
          />
          <MetricGrid
            {...gridHandlers}
            growWithData
            metricsState={invoices.state}
            onRetry={invoices.refetch}
            gridSize={5}
            size="sm"
            className="position-metrics"
            redirectToValue="/invoice-management/list"
          />
        </div>

        {/* Timesheet Metrics Section */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="timesheetDataToggle"
            labelAs="h1"
            label={toggleDescriptions.timesheet}
            description={t("dashboard.toggleAllRecruitersTimesheetData")}
          />
          <div className="position-metrics-grid">
            <MetricGrid
              {...gridHandlers}
              growWithData
              metricsState={timesheets.state}
              onRetry={timesheets.refetch}
              gridSize={timesheets.state.data.length || 8}
              size="sm"
              className="position-metrics"
              redirectToValue="/timesheet-management"
            />
          </div>
        </div>

        {/* AI Insights Section */}
        <AIInsightsSection
          {...gridHandlers}
          aiMetrics={aiMetrics}
          basicAiInsights={basicAiInsights}
        />

        {/* Client Metrics Section */}
        <div className="client-metrics-container">
          <DataViewToggle
            id="clientDataToggle"
            labelAs="h1"
            label={toggleDescriptions.client}
            description={t("dashboard.toggleAllRecruitersClientData")}
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
