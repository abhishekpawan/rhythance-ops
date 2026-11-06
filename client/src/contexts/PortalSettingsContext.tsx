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
import {
  getPortalSettings,
  getPublicPortalSettings,
} from "../services/api/portalSettings";

interface PortalSettingsContextValue {
  /** Value of every setting, by key. Empty until loaded. */
  values: Record<string, string>;
  /** True once the settings have been loaded successfully (logged in). */
  ready: boolean;
  /** True once the public settings (legal pages) are loaded; works logged out. */
  publicReady: boolean;
  /** The public settings could not be loaded. */
  publicFailed: boolean;
  refresh: () => Promise<void>;
}

const PortalSettingsContext = createContext<PortalSettingsContextValue>({
  values: {},
  ready: false,
  publicReady: false,
  publicFailed: false,
  refresh: async () => {},
});

export function PortalSettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [publicValues, setPublicValues] = useState<Record<string, string>>({});
  const [publicReady, setPublicReady] = useState(false);
  const [publicFailed, setPublicFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setValues(await getPortalSettings());
      setReady(true);
    } catch (error) {
      // Keep whatever was loaded before; pages that need a value check `ready`.
      console.error("Failed to load portal settings:", error);
    }
  }, []);

  // The public settings (legal pages) are needed before anyone logs in.
  useEffect(() => {
    let cancelled = false;
    getPublicPortalSettings()
      .then((loaded) => {
        if (cancelled) return;
        setPublicValues(loaded);
        setPublicReady(true);
      })
      .catch((error) => {
        console.error("Failed to load public portal settings:", error);
        if (!cancelled) setPublicFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setValues({});
      setReady(false);
    }
  }, [isAuthenticated, refresh]);

  // Logged-in values include the public ones, so they win when both exist.
  const merged = useMemo(
    () => ({ ...publicValues, ...values }),
    [publicValues, values]
  );

  const value = useMemo(
    () => ({
      values: merged,
      ready,
      publicReady: publicReady || ready,
      publicFailed,
      refresh,
    }),
    [merged, ready, publicReady, publicFailed, refresh]
  );

  return (
    <PortalSettingsContext.Provider value={value}>
      {children}
    </PortalSettingsContext.Provider>
  );
}

export function usePortalSettings() {
  return useContext(PortalSettingsContext);
}

/** `const title = usePortalSetting("branding.aiChatTitle")` (undefined until loaded) */
export function usePortalSetting(key: string): string | undefined {
  return useContext(PortalSettingsContext).values[key];
}
