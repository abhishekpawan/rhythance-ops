import { useMemo, useState } from "react";
import {
  AlertCircle,
  Flag,
  Loader2,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { Toast } from "../../components/Toast";
import { useLanguage } from "../../contexts/language/language-provider";
import type { FeatureFlagCategory } from "../../services/api/featureFlags";
import { FeatureFlagCard } from "./FeatureFlagCard";
import { useFeatureFlagsAdmin } from "./useFeatureFlagsAdmin";
import "../../styles/pages/FeatureFlags.css";

type Filter = "all" | "controls" | "tracking";

const CATEGORY_ORDER: FeatureFlagCategory[] = [
  "dashboard",
  "positions",
  "jobseeker_profile",
  "admin",
];

export function FeatureFlagsPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const {
    data,
    loading,
    error,
    savingKey,
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
  } = useFeatureFlagsAdmin();

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

                {items.map((flag) => (
                  <FeatureFlagCard
                    key={flag.key}
                    flag={flag}
                    portals={data.portals}
                    tableMissing={data.tableMissing}
                    savingKey={savingKey}
                    stateLabel={stateLabel}
                    settingText={settingText}
                    settingsChanged={settingsChanged}
                    setDrafts={setDrafts}
                    setPending={setPending}
                    saveSettings={saveSettings}
                    resetFlag={resetFlag}
                  />
                ))}
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
