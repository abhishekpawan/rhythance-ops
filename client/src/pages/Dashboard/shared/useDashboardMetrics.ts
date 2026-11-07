/**
 * Data hooks shared by the admin and recruiter dashboards: a 30-second cache,
 * the metric fetcher (one recruiter or all recruiters) and the AI summary.
 */
import { useState, useCallback, useRef } from "react";
import {
  getAllRecruitersMetrics,
  getRecruiterMetrics,
  getAllRecruitersClientMetrics,
  getRecruiterClientMetrics,
  getAllRecruitersPositionMetrics,
  getRecruiterPositionMetrics,
} from "../../../services/api/recruiterMetrics";
import {
  getAIInsightsWithTimeRange,
  getAIInsights,
  type AIInsightsResponse,
} from "../../../services/api/aiInsights";
import { MetricData } from "../../../components/dashboard/types";
import {
  APIResponse,
  METRIC_CONFIGS,
  MetricsState,
  MetricsType,
} from "./metricConfig";
import {
  getCacheKey,
  isCacheValid,
  transformMetricsResponse,
} from "./metricTransforms";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function useCache<T>() {
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());

  const getFromCache = useCallback((key: string): T | null => {
    const cached = cache.current.get(key);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    return null;
  }, []);

  const setCache = useCallback((key: string, data: T) => {
    cache.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);

  return { getFromCache, setCache, clearCache };
}

/**
 * Fetches one group of metric cards. `showAll` picks all recruiters' data
 * instead of `userId`'s own; the admin dashboard always passes true.
 */
export const useMetricsFetch = (
  userId: string | null,
  showAll: boolean,
  type: MetricsType
) => {
  const [state, setState] = useState<MetricsState>({
    data: [],
    loading: false,
    error: null,
  });

  const { getFromCache, setCache, clearCache } = useCache<MetricData[]>();
  const fetchingRef = useRef(false);

  const fetchData = useCallback(
    async (forceShowAll?: boolean) => {
      if (!userId && type !== "aiInsights") return;

      const currentShowAll =
        forceShowAll !== undefined ? forceShowAll : showAll;
      const cacheKey = getCacheKey(type, currentShowAll, userId || undefined);

      // Return cached data if valid
      const cached = getFromCache(cacheKey);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        return;
      }

      // Prevent multiple simultaneous requests
      if (fetchingRef.current) return;

      fetchingRef.current = true;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        let response: APIResponse;
        let configType: keyof typeof METRIC_CONFIGS;

        switch (type) {
          case "metrics":
            response = currentShowAll
              ? await getAllRecruitersMetrics({ timeRange: "12" })
              : await getRecruiterMetrics(userId!, { timeRange: "12" });
            configType = "recruiter";
            break;
          case "clients":
            response = currentShowAll
              ? await getAllRecruitersClientMetrics({ timeRange: "12" })
              : await getRecruiterClientMetrics(userId!, { timeRange: "12" });
            configType = "client";
            break;
          case "positions":
            response = currentShowAll
              ? await getAllRecruitersPositionMetrics({ timeRange: "12" })
              : await getRecruiterPositionMetrics(userId!, { timeRange: "12" });
            configType = "position";
            break;
          case "aiInsights":
            response = await getAIInsightsWithTimeRange({ months: "12" });
            configType = "ai";
            break;
        }

        const transformedData = transformMetricsResponse(response, configType);

        setCache(cacheKey, transformedData);
        setState({ data: transformedData, loading: false, error: null });
      } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        setState({
          data: [],
          loading: false,
          error:
            error instanceof Error ? error.message : `Failed to fetch ${type}`,
        });
      } finally {
        fetchingRef.current = false;
      }
    },
    [userId, showAll, type, getFromCache, setCache]
  );

  const retry = useCallback(() => {
    clearCache(getCacheKey(type, showAll, userId || undefined));
    fetchingRef.current = false;
    fetchData();
  }, [type, showAll, userId, clearCache, fetchData]);

  /** Empties the cards and shows their loading state (before switching view). */
  const resetToLoading = useCallback(() => {
    setState({ data: [], loading: true, error: null });
  }, []);

  return { state, fetchData, retry, clearCache, resetToLoading };
};

export const useBasicAIInsights = () => {
  const [state, setState] = useState<{
    data: AIInsightsResponse | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const { getFromCache, setCache, clearCache } = useCache<AIInsightsResponse>();
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    const cacheKey = "basicAiInsights";

    // Return cached data if valid
    const cached = getFromCache(cacheKey);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await getAIInsights();
      setCache(cacheKey, response);
      setState({ data: response, loading: false, error: null });
    } catch (error) {
      console.error("Error fetching basic AI insights:", error);
      setState({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch basic AI insights",
      });
    } finally {
      fetchingRef.current = false;
    }
  }, [getFromCache, setCache]);

  const retry = useCallback(() => {
    clearCache("basicAiInsights");
    fetchingRef.current = false;
    fetchData();
  }, [clearCache, fetchData]);

  return { state, fetchData, retry };
};

/** Which metric cards have their graph open (they span two grid columns). */
export const useExpandedGraphs = () => {
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());

  const handleToggleGraph = useCallback((show: boolean, metricId?: string) => {
    if (!metricId) return;
    setExpandedGraphs((prev) => {
      const next = new Set(prev);
      if (show) next.add(metricId);
      else next.delete(metricId);
      return next;
    });
  }, []);

  return { expandedGraphs, handleToggleGraph };
};
