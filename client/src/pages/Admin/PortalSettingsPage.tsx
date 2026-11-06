import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Save,
  TriangleAlert,
  Undo2,
  Building2,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { Toast } from "../../components/Toast";
import { useLanguage } from "../../contexts/language/language-provider";
import { usePortalSettings } from "../../contexts/PortalSettingsContext";
import {
  getPortalSettingsAdmin,
  savePortalSettings,
  type PortalSettingGroup,
  type PortalSettingItem,
  type PortalSettingsAdminResponse,
} from "../../services/api/portalSettings";
import { formatDateTimeCanada } from "../../utils/dateUtils";
import "../../styles/pages/FeatureFlags.css";
import "../../styles/pages/PortalSettings.css";

const GROUP_ORDER: PortalSettingGroup[] = ["company", "branding", "training"];

interface ToastState {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
}

export function PortalSettingsPage() {
  const { t } = useLanguage();
  const { refresh: refreshAppSettings } = usePortalSettings();

  const [data, setData] = useState<PortalSettingsAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Text typed into the fields and not saved yet, by setting key
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getPortalSettingsAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("portalSettings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // A field starts empty when the portal has no value of its own, so the value
  // in use (environment or default) shows as the placeholder.
  const storedText = (setting: PortalSettingItem) =>
    setting.source === "database" ? setting.value : "";
  const textOf = (setting: PortalSettingItem) =>
    drafts[setting.key] ?? storedText(setting);

  const changedKeys = useMemo(
    () =>
      (data?.settings ?? [])
        .filter(
          (setting) =>
            (drafts[setting.key] ?? storedText(setting)) !== storedText(setting)
        )
        .map((setting) => setting.key),
    [data, drafts]
  );

  const showToast = (message: string, type: ToastState["type"]) =>
    setToast({ message, type, isVisible: true });

  const save = async () => {
    const values = Object.fromEntries(
      changedKeys.map((key) => [key, drafts[key] ?? ""])
    );
    setSaving(true);
    try {
      setData(await savePortalSettings(values));
      setDrafts({});
      void refreshAppSettings();
      showToast(t("portalSettings.saved"), "success");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : t("portalSettings.saveError"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: (data?.settings ?? []).filter((setting) => setting.group === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className="ff-page">
      <AppHeader title={t("portalSettings.title")} />

      <div className="ff-container">
        <header className="ff-intro">
          <div className="ff-intro-icon">
            <Building2 size={22} />
          </div>
          <p className="ff-subtitle">{t("portalSettings.subtitle")}</p>
        </header>

        {loading && (
          <div className="ff-state">
            <Loader2 size={28} className="ff-spinner" />
          </div>
        )}

        {!loading && error && (
          <div className="ff-banner ff-banner--error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!loading && data && (
          <>
            {data.tableMissing && (
              <div className="ff-banner ff-banner--warning" role="status">
                <TriangleAlert size={18} />
                <div>
                  <strong>{t("portalSettings.setupNeededTitle")}</strong>
                  <p>{t("portalSettings.setupNeededMessage")}</p>
                </div>
              </div>
            )}
            {data.loadFailed && (
              <div className="ff-banner ff-banner--error" role="alert">
                <AlertCircle size={18} />
                <span>{t("portalSettings.loadFailedMessage")}</span>
              </div>
            )}

            <div className="ps-actionbar" role="region" aria-live="polite">
              <span className="ps-actionbar-text">
                {changedKeys.length > 0
                  ? t("portalSettings.unsaved", { count: changedKeys.length })
                  : t("portalSettings.hint")}
              </span>
              <div className="ps-actionbar-buttons">
                <button
                  type="button"
                  className="ff-reset"
                  disabled={saving || changedKeys.length === 0}
                  onClick={() => setDrafts({})}
                >
                  <Undo2 size={13} />
                  {t("portalSettings.discard")}
                </button>
                <button
                  type="button"
                  className="ff-settings-save ps-save"
                  disabled={
                    saving || changedKeys.length === 0 || data.tableMissing
                  }
                  onClick={() => void save()}
                >
                  {saving ? (
                    <Loader2 size={14} className="ff-spinner" />
                  ) : (
                    <Save size={14} />
                  )}
                  {t("portalSettings.save")}
                </button>
              </div>
            </div>

            {grouped.map(({ group, items }) => (
              <section className="ff-group" key={group}>
                <h2 className="ff-group-title">
                  {t(`portalSettings.groups.${group}`)}
                </h2>
                <article className="ff-card ps-card">
                  <div className="ps-fields">
                    {items.map((setting) => (
                      <label className="ff-setting" key={setting.key}>
                        <span className="ff-setting-label">
                          {setting.label}
                          <em
                            className={`ff-setting-source ${setting.source === "database" ? "ff-setting-source--set" : ""}`}
                          >
                            {t(`portalSettings.source.${setting.source}`)}
                          </em>
                        </span>
                        {setting.multiline ? (
                          <textarea
                            className="ff-setting-input ps-textarea"
                            value={textOf(setting)}
                            placeholder={setting.value}
                            rows={6}
                            disabled={saving}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [setting.key]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <input
                            type="text"
                            className="ff-setting-input"
                            value={textOf(setting)}
                            placeholder={setting.value}
                            maxLength={300}
                            disabled={saving}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [setting.key]: e.target.value,
                              }))
                            }
                          />
                        )}
                        {setting.description && (
                          <span className="ff-setting-hint">
                            {setting.description}
                          </span>
                        )}
                        {setting.updatedAt && (
                          <span className="ff-setting-hint">
                            {t("portalSettings.lastChanged", {
                              name: setting.updatedByName || "—",
                              date: formatDateTimeCanada(setting.updatedAt),
                            })}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </article>
              </section>
            ))}
          </>
        )}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        duration={4000}
      />
    </div>
  );
}
