import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  Link2Off,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { Toast } from "../../components/Toast";
import { useLanguage } from "../../contexts/language/language-provider";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import {
  getFeatureFlagsAdmin,
  resetFeatureFlagValue,
  saveFeatureFlagSettings,
  setFeatureFlagValue,
  type FeatureFlagAdminItem,
  type FeatureFlagCategory,
  type FeatureFlagSettingValue,
  type FeatureFlagsAdminResponse,
} from "../../services/api/featureFlags";
import { formatDateTimeCanada } from "../../utils/dateUtils";
import "../../styles/pages/FeatureFlags.css";

type Filter = "all" | "controls" | "tracking";

const CATEGORY_ORDER: FeatureFlagCategory[] = [
  "dashboard",
  "positions",
  "jobseeker_profile",
  "admin",
];

interface ToastState {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
}

export function FeatureFlagsPage() {
  const { t } = useLanguage();
  const { refresh: refreshAppFlags } = useFeatureFlags();

  const [data, setData] = useState<FeatureFlagsAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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

  const flags = data?.flags ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags.filter((f) => {
      if (filter === "controls" && !f.wired) return false;
      if (filter === "tracking" && f.wired) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
      );
    });
  }, [flags, query, filter]);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: visible.filter((f) => f.category === category),
  })).filter((g) => g.items.length > 0);

  const summary = {
    total: flags.length,
    enabled: flags.filter((f) => f.enabled).length,
    customized: flags.filter((f) => f.source === "override").length,
    tracking: flags.filter((f) => !f.wired).length,
  };

  return (
    <div className="ff-page">
      <AppHeader title={t("featureFlags.title")} />

      <div className="ff-container">
        <header className="ff-intro">
          <div className="ff-intro-icon">
            <Flag size={22} />
          </div>
          <p className="ff-subtitle">{t("featureFlags.subtitle")}</p>
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
                  <strong>{t("featureFlags.setupNeededTitle")}</strong>
                  <p>{t("featureFlags.setupNeededMessage")}</p>
                </div>
              </div>
            )}
            {data.loadFailed && (
              <div className="ff-banner ff-banner--error" role="alert">
                <AlertCircle size={18} />
                <span>{t("featureFlags.loadFailedMessage")}</span>
              </div>
            )}

            <section className="ff-summary" aria-label="Summary">
              {(
                [
                  ["total", summary.total],
                  ["enabled", summary.enabled],
                  ["customized", summary.customized],
                  ["tracking", summary.tracking],
                ] as const
              ).map(([key, value]) => (
                <div className="ff-summary-card" key={key}>
                  <span className="ff-summary-value">{value}</span>
                  <span className="ff-summary-label">
                    {t(`featureFlags.summary.${key}`)}
                  </span>
                </div>
              ))}
            </section>

            <div className="ff-toolbar">
              <label className="ff-search">
                <Search size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("featureFlags.searchPlaceholder")}
                  aria-label={t("featureFlags.searchPlaceholder")}
                />
              </label>
              <div className="ff-segmented" role="tablist">
                {(["all", "controls", "tracking"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    className={`ff-segment ${filter === f ? "ff-segment--active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {t(`featureFlags.filters.${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {grouped.length === 0 && (
              <div className="ff-empty">
                <SlidersHorizontal size={32} />
                <p>{t("featureFlags.empty")}</p>
              </div>
            )}

            {grouped.map(({ category, items }) => (
              <section className="ff-group" key={category}>
                <h2 className="ff-group-title">
                  {t(`featureFlags.categories.${category}`)}
                </h2>

                {items.map((flag) => {
                  const saving = savingKey === flag.key;
                  return (
                    <article
                      className={`ff-card ${flag.wired ? "" : "ff-card--tracking"}`}
                      key={flag.key}
                    >
                      <div className="ff-card-main">
                        <div className="ff-card-head">
                          <h3 className="ff-card-title">{flag.title}</h3>
                          <code className="ff-key">{flag.key}</code>
                        </div>
                        <p className="ff-desc">{flag.description}</p>
                        {flag.notes && <p className="ff-notes">{flag.notes}</p>}

                        <div className="ff-badges">
                          <span
                            className={`ff-badge ${flag.wired ? "ff-badge--controls" : "ff-badge--tracking"}`}
                          >
                            {flag.wired ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <Link2Off size={12} />
                            )}
                            {flag.wired
                              ? t("featureFlags.status.controls")
                              : t("featureFlags.status.tracking")}
                          </span>
                          <span
                            className={`ff-badge ${flag.source === "override" ? "ff-badge--changed" : "ff-badge--default"}`}
                          >
                            {flag.source === "override"
                              ? t("featureFlags.status.customized")
                              : t("featureFlags.status.default")}
                          </span>
                        </div>

                        {flag.settingValues.length > 0 && (
                          <div className="ff-settings">
                            <span className="ff-settings-title">
                              {t("featureFlags.settings.title")}
                            </span>
                            {flag.settingValues.map((setting) => (
                              <label className="ff-setting" key={setting.key}>
                                <span className="ff-setting-label">
                                  {setting.label}
                                  <em
                                    className={`ff-setting-source ${setting.source === "database" ? "ff-setting-source--set" : ""}`}
                                  >
                                    {setting.source === "database"
                                      ? t("featureFlags.settings.fromDatabase")
                                      : t("featureFlags.settings.fromDefault")}
                                  </em>
                                </span>
                                <input
                                  type="text"
                                  className="ff-setting-input"
                                  value={settingText(flag, setting)}
                                  placeholder={setting.defaultValue}
                                  maxLength={300}
                                  disabled={
                                    savingKey === flag.key || !flag.wired
                                  }
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [flag.key]: {
                                        ...prev[flag.key],
                                        [setting.key]: e.target.value,
                                      },
                                    }))
                                  }
                                />
                                {setting.description && (
                                  <span className="ff-setting-hint">
                                    {setting.description}
                                  </span>
                                )}
                              </label>
                            ))}
                            <div className="ff-settings-actions">
                              <button
                                type="button"
                                className="ff-settings-save"
                                disabled={
                                  savingKey === flag.key ||
                                  !settingsChanged(flag)
                                }
                                onClick={() => void saveSettings(flag)}
                              >
                                {t("featureFlags.settings.save")}
                              </button>
                              <button
                                type="button"
                                className="ff-reset"
                                disabled={
                                  savingKey === flag.key ||
                                  !flag.settingValues.some(
                                    (setting) => setting.source === "database"
                                  )
                                }
                                onClick={() => void saveSettings(flag, true)}
                              >
                                <RotateCcw size={13} />
                                {t("featureFlags.settings.useDefaults")}
                              </button>
                              <span className="ff-setting-hint">
                                {t("featureFlags.settings.hint")}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="ff-intended">
                          <span className="ff-intended-label">
                            {t("featureFlags.intendedTitle")}
                          </span>
                          <div className="ff-portals">
                            {data.portals.map((portal) => {
                              const value = flag.intended[portal.id];
                              if (value === undefined) return null;
                              return (
                                <span
                                  key={portal.id}
                                  className={`ff-portal ${value ? "ff-portal--on" : "ff-portal--off"}`}
                                >
                                  {portal.label}
                                  <b>{stateLabel(value)}</b>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {!flag.wired && (
                          <p className="ff-hint">
                            {t("featureFlags.notConnected")}
                          </p>
                        )}
                      </div>

                      <div className="ff-card-side">
                        <div className="ff-switch-row">
                          <span
                            className={`ff-switch-state ${flag.enabled ? "ff-switch-state--on" : ""}`}
                          >
                            {t("featureFlags.thisPortal", {
                              state: stateLabel(flag.enabled),
                            })}
                          </span>
                          {saving ? (
                            <Loader2 size={20} className="ff-spinner" />
                          ) : (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={flag.enabled}
                              aria-label={flag.title}
                              className={`ff-switch ${flag.enabled ? "ff-switch--on" : ""}`}
                              disabled={!flag.wired || data.tableMissing}
                              title={
                                flag.wired
                                  ? undefined
                                  : t("featureFlags.notConnected")
                              }
                              onClick={() =>
                                setPending({ flag, next: !flag.enabled })
                              }
                            >
                              <span className="ff-switch-thumb" />
                            </button>
                          )}
                        </div>

                        {flag.source === "override" && flag.wired && (
                          <button
                            type="button"
                            className="ff-reset"
                            disabled={saving}
                            title={t("featureFlags.resetTitle", {
                              value: stateLabel(flag.defaultEnabled),
                            })}
                            onClick={() => void resetFlag(flag)}
                          >
                            <RotateCcw size={13} />
                            {t("featureFlags.reset")}
                          </button>
                        )}

                        {flag.updatedAt && (
                          <span className="ff-changed">
                            {t("featureFlags.changedBy", {
                              name: flag.updatedByName || "—",
                              date: formatDateTimeCanada(flag.updatedAt),
                            })}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={pending !== null}
        title={
          pending?.next
            ? t("featureFlags.confirm.enableTitle")
            : t("featureFlags.confirm.disableTitle")
        }
        message={t("featureFlags.confirm.message", {
          name: pending?.flag.title ?? "",
        })}
        confirmText={
          pending?.next
            ? t("featureFlags.confirm.enable")
            : t("featureFlags.confirm.disable")
        }
        cancelText={t("buttons.cancel")}
        confirmButtonClass="primary"
        onConfirm={() => void applyChange()}
        onCancel={() => setPending(null)}
      />

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
