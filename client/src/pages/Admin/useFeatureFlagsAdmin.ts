import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../contexts/language/language-provider";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import {
  getFeatureFlagsAdmin,
  resetFeatureFlagValue,
  saveFeatureFlagSettings,
  setFeatureFlagValue,
  type FeatureFlagAdminItem,
  type FeatureFlagSettingValue,
  type FeatureFlagsAdminResponse,
} from "../../services/api/featureFlags";

interface ToastState {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
}

/** The data of the feature flags page and what its buttons do: load, switch, save a flag's texts, reset. */
export function useFeatureFlagsAdmin() {
  const { t } = useLanguage();
  const { refresh: refreshAppFlags } = useFeatureFlags();

  const [data, setData] = useState<FeatureFlagsAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Text being typed into a flag's settings, before it is saved
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {}
  );
  const [pending, setPending] = useState<{
    flag: FeatureFlagAdminItem;
    next: boolean;
  } | null>(null);
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFeatureFlagsAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("featureFlags.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (message: string, type: ToastState["type"]) =>
    setToast({ message, type, isVisible: true });

  const replaceFlag = (updated: FeatureFlagAdminItem) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            flags: prev.flags.map((f) => (f.key === updated.key ? updated : f)),
          }
        : prev
    );

  const stateLabel = (on: boolean) =>
    on ? t("featureFlags.status.on") : t("featureFlags.status.off");

  const applyChange = async () => {
    if (!pending) return;
    const { flag, next } = pending;
    setPending(null);
    setSavingKey(flag.key);
    try {
      replaceFlag(await setFeatureFlagValue(flag.key, next));
      void refreshAppFlags();
      showToast(
        t("featureFlags.toast.updated", {
          name: flag.title,
          state: stateLabel(next).toLowerCase(),
        }),
        "success"
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : t("featureFlags.toast.failed"),
        "error"
      );
    } finally {
      setSavingKey(null);
    }
  };

  // A field starts empty when it uses the default, so the default shows as a placeholder
  const storedSettingText = (setting: FeatureFlagSettingValue) =>
    setting.source === "database" ? setting.value : "";
  const settingText = (
    flag: FeatureFlagAdminItem,
    setting: FeatureFlagSettingValue
  ) => drafts[flag.key]?.[setting.key] ?? storedSettingText(setting);
  const settingsChanged = (flag: FeatureFlagAdminItem) =>
    flag.settingValues.some(
      (setting) => settingText(flag, setting) !== storedSettingText(setting)
    );

  const saveSettings = async (
    flag: FeatureFlagAdminItem,
    useDefaults = false
  ) => {
    const config = Object.fromEntries(
      flag.settingValues.map((setting) => [
        setting.key,
        useDefaults ? "" : settingText(flag, setting),
      ])
    );
    setSavingKey(flag.key);
    try {
      replaceFlag(await saveFeatureFlagSettings(flag.key, config));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[flag.key];
        return next;
      });
      void refreshAppFlags();
      showToast(
        t("featureFlags.settings.saved", { name: flag.title }),
        "success"
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : t("featureFlags.toast.failed"),
        "error"
      );
    } finally {
      setSavingKey(null);
    }
  };

  const resetFlag = async (flag: FeatureFlagAdminItem) => {
    setSavingKey(flag.key);
    try {
      replaceFlag(await resetFeatureFlagValue(flag.key));
      void refreshAppFlags();
      showToast(t("featureFlags.toast.reset", { name: flag.title }), "success");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : t("featureFlags.toast.failed"),
        "error"
      );
    } finally {
      setSavingKey(null);
    }
  };

  return {
    data,
    loading,
    error,
    savingKey,
    drafts,
    setDrafts,
    pending,
    setPending,
    toast,
    setToast,
    stateLabel,
    applyChange,
    settingText,
    settingsChanged,
    saveSettings,
    resetFlag,
  };
}
