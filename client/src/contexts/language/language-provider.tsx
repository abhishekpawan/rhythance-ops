import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  applyBrandTokens,
  getPublicSettings,
  subscribePublicSettings,
} from "../publicSettingsStore";
import coreEn from "./locales/en.json";
import timesheetEn from "./locales/en/timesheet.json";
import reportsEn from "./locales/en/reports.json";
import profileEn from "./locales/en/profile.json";
import supportEn from "./locales/en/support.json";
import featureFlagsEn from "./locales/en/featureFlags.json";
import jobseekerDashboardEn from "./locales/en/jobseekerDashboard.json";
import dashboardEn from "./locales/en/dashboard.json";
import profileRulesEn from "./locales/en/profileRules.json";
import portalSettingsEn from "./locales/en/portalSettings.json";
import coreFr from "./locales/fr.json";
import timesheetFr from "./locales/fr/timesheet.json";
import reportsFr from "./locales/fr/reports.json";
import profileFr from "./locales/fr/profile.json";
import supportFr from "./locales/fr/support.json";
import featureFlagsFr from "./locales/fr/featureFlags.json";
import jobseekerDashboardFr from "./locales/fr/jobseekerDashboard.json";
import dashboardFr from "./locales/fr/dashboard.json";
import profileRulesFr from "./locales/fr/profileRules.json";
import portalSettingsFr from "./locales/fr/portalSettings.json";
import { mergeLocale } from "./mergeLocales";

export type Language = "en" | "fr";

interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
}

interface LanguageProviderState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, interpolations?: Record<string, string | number>) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<Language, Record<string, any>> = {
  en: mergeLocale(
    coreEn,
    timesheetEn,
    reportsEn,
    profileEn,
    supportEn,
    featureFlagsEn,
    jobseekerDashboardEn,
    dashboardEn,
    profileRulesEn,
    portalSettingsEn
  ),
  fr: mergeLocale(
    coreFr,
    timesheetFr,
    reportsFr,
    profileFr,
    supportFr,
    featureFlagsFr,
    jobseekerDashboardFr,
    dashboardFr,
    profileRulesFr,
    portalSettingsFr
  ),
};

const initialState: LanguageProviderState = {
  language: "en",
  setLanguage: () => null,
  t: () => "",
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

// Helper function to get nested translation value
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNestedValue = (obj: Record<string, any>, path: string): string | undefined => {
  const result = path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && current[key] !== undefined ? current[key] : undefined;
  }, obj);
  return typeof result === 'string' ? result : undefined;
};

// Helper function to interpolate variables in translation strings
const interpolateString = (template: string, variables: Record<string, string | number>): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
};

export function LanguageProvider({
  children,
  defaultLanguage = "en",
  storageKey = "app-language",
  ...props
}: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(storageKey) as Language) || defaultLanguage
  );

  // Re-render when the public settings (brand name) load or change. `t` writes the brand name from these
  // settings (applyBrandTokens), so what it writes is a dependency of `t` below: without it `t` would keep the
  // brand name it saw before the settings loaded. Only the brand name counts: every load of the settings makes
  // a new object, and a `t` that changed with it would make screens fetch again for nothing.
  const publicSettings = useSyncExternalStore(
    subscribePublicSettings,
    getPublicSettings
  );
  const brandName = publicSettings["branding.brandName"]; // the only value applyBrandTokens reads

  useEffect(() => {
    localStorage.setItem(storageKey, language);
    // Set a class or data attribute on <html> for language
    document.documentElement.setAttribute("lang", language);
  }, [language, storageKey]);

  // Translation function. Its identity changes only with the language or the public settings, so screens that
  // list `t` in an effect or callback do not run again on every render of the provider.
  const t = useCallback(
    (key: string, interpolations?: Record<string, string | number>): string => {
      const currentTranslations = translations[language];
      let translatedValue = getNestedValue(currentTranslations, key);

      // Fallback to English if translation is not found
      if (translatedValue === undefined && language !== "en") {
        translatedValue = getNestedValue(translations.en, key);
      }

      // If still not found, return the key itself
      if (translatedValue === undefined) {
        console.warn(`Translation missing for key: ${key}`);
        return key;
      }

      // If interpolations are provided, replace placeholders
      if (interpolations && typeof translatedValue === 'string') {
        return applyBrandTokens(interpolateString(translatedValue, interpolations));
      }

      return applyBrandTokens(String(translatedValue));
    },
    // brandName is read by applyBrandTokens through the store, not through this closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, brandName]
  );

  const changeLanguage = useCallback(
    (lang: Language) => {
      localStorage.setItem(storageKey, lang);
      setLanguage(lang);
    },
    [storageKey]
  );

  const value = useMemo(
    () => ({ language, setLanguage: changeLanguage, t }),
    [language, changeLanguage, t]
  );

  return (
    <LanguageProviderContext.Provider {...props} value={value}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageProviderContext);
  if (context === undefined)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}; 