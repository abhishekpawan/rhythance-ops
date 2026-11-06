import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  getPublicSettings,
  hasPublicSettings,
  setPublicSettings,
  subscribePublicSettings,
} from "./publicSettingsStore";
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
  // Public settings live in a small store so translations can use them too
  const publicValues = useSyncExternalStore(
    subscribePublicSettings,
    getPublicSettings
  );
  const publicReady = useSyncExternalStore(
    subscribePublicSettings,
    hasPublicSettings
  );
  const [publicFailed, setPublicFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const loadPublic = useCallback(async () => {
    try {
      setPublicSettings(await getPublicPortalSettings());
      setPublicFailed(false);
    } catch (error) {
      console.error("Failed to load public portal settings:", error);
      setPublicFailed(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    void loadPublic();
    try {
      setValues(await getPortalSettings());
      setReady(true);
    } catch (error) {
      // Keep whatever was loaded before; pages that need a value check `ready`.
      console.error("Failed to load portal settings:", error);
    }
  }, [loadPublic]);

  // The public settings (brand name, legal pages, ...) are needed before login.
  useEffect(() => {
    void loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setValues({});
      setReady(false);
    }
  }, [isAuthenticated, refresh]);

  // Browser tab title: "<brand> Operations Portal"
  const brandName = publicValues["branding.brandName"];
  useEffect(() => {
    if (brandName) document.title = `${brandName} Operations Portal`;
  }, [brandName]);

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

  // First visit in this browser: wait for the brand before drawing anything, so
  // the page never shows another portal's name. Later visits use the remembered
  // values and draw immediately.
  if (!publicReady && !publicFailed) return null;

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
