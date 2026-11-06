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
import { getPortalSettings } from "../services/api/portalSettings";

interface PortalSettingsContextValue {
  /** Value of every setting, by key. Empty until loaded. */
  values: Record<string, string>;
  /** True once the settings have been loaded successfully. */
  ready: boolean;
  refresh: () => Promise<void>;
}

const PortalSettingsContext = createContext<PortalSettingsContextValue>({
  values: {},
  ready: false,
  refresh: async () => {},
});

export function PortalSettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setValues({});
      setReady(false);
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({ values, ready, refresh }),
    [values, ready, refresh]
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
