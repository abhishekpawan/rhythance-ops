import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { getFeatureFlags } from "../services/api/featureFlags";

interface FeatureFlagsContextValue {
  /** Effective on/off value per flag key. Empty until loaded. */
  flags: Record<string, boolean>;
  loading: boolean;
  /** True once the first load has finished (successfully or not). */
  ready: boolean;
  /**
   * Whether a flag is on. While flags are loading, or if loading failed, the
   * `fallback` is returned. Pass the flag's default as the fallback so a failed
   * request never hides a feature that is on by default.
   */
  isEnabled: (key: string, fallback?: boolean) => boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  loading: false,
  ready: false,
  isEnabled: (_key, fallback = false) => fallback,
  refresh: async () => {},
});

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFlags(await getFeatureFlags());
      setLoaded(true);
    } catch (error) {
      // Keep the previous values (or fallbacks) when the request fails.
      console.error("Failed to load feature flags:", error);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setFlags({});
      setLoaded(false);
      setReady(false);
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      loading,
      ready,
      isEnabled: (key, fallback = false) =>
        loaded && key in flags ? flags[key] : fallback,
      refresh,
    }),
    [flags, loaded, loading, ready, refresh]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/** `const showX = useFeatureFlag("some_flag", true)` */
export function useFeatureFlag(key: string, fallback = false): boolean {
  return useContext(FeatureFlagsContext).isEnabled(key, fallback);
}
