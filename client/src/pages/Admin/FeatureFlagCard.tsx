import { CheckCircle2, Link2Off, Loader2, RotateCcw } from "lucide-react";
import { StatusBadge } from "../../components/StatusBadge";
import { useLanguage } from "../../contexts/language/language-provider";
import type {
  FeatureFlagAdminItem,
  FeatureFlagSettingValue,
  FeatureFlagsAdminResponse,
} from "../../services/api/featureFlags";
import { formatDateTimeCanada } from "../../utils/dateUtils";

interface FeatureFlagCardProps {
  flag: FeatureFlagAdminItem;
  portals: FeatureFlagsAdminResponse["portals"];
  tableMissing: boolean;
  savingKey: string | null;
  stateLabel: (on: boolean) => string;
  settingText: (
    flag: FeatureFlagAdminItem,
    setting: FeatureFlagSettingValue
  ) => string;
  settingsChanged: (flag: FeatureFlagAdminItem) => boolean;
  setDrafts: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, string>>>
  >;
  setPending: (pending: { flag: FeatureFlagAdminItem; next: boolean }) => void;
  saveSettings: (
    flag: FeatureFlagAdminItem,
    useDefaults?: boolean
  ) => Promise<void>;
  resetFlag: (flag: FeatureFlagAdminItem) => Promise<void>;
}

export function FeatureFlagCard({
  flag,
  portals,
  tableMissing,
  savingKey,
  stateLabel,
  settingText,
  settingsChanged,
  setDrafts,
  setPending,
  saveSettings,
  resetFlag,
}: FeatureFlagCardProps) {
  const { t } = useLanguage();
  const saving = savingKey === flag.key;
  return (
    <article className={`ff-card ${flag.wired ? "" : "ff-card--tracking"}`}>
      <div className="ff-card-main">
        <div className="ff-card-head">
          <h3 className="ff-card-title">{flag.title}</h3>
          <code className="ff-key">{flag.key}</code>
        </div>
        <p className="ff-desc">{flag.description}</p>
        {flag.notes && <p className="ff-notes">{flag.notes}</p>}

        <div className="ff-badges">
          <StatusBadge
            variant="plain"
            baseClass="ff-badge"
            tone={flag.wired ? "ff-badge--controls" : "ff-badge--tracking"}
            icon={
              flag.wired ? <CheckCircle2 size={12} /> : <Link2Off size={12} />
            }
            label={
              flag.wired
                ? t("featureFlags.status.controls")
                : t("featureFlags.status.tracking")
            }
          />
          <StatusBadge
            variant="plain"
            baseClass="ff-badge"
            tone={
              flag.source === "override"
                ? "ff-badge--changed"
                : "ff-badge--default"
            }
            label={
              flag.source === "override"
                ? t("featureFlags.status.customized")
                : t("featureFlags.status.default")
            }
          />
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
                  disabled={savingKey === flag.key || !flag.wired}
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
                  <span className="ff-setting-hint">{setting.description}</span>
                )}
              </label>
            ))}
            <div className="ff-settings-actions">
              <button
                type="button"
                className="ff-settings-save"
                disabled={savingKey === flag.key || !settingsChanged(flag)}
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
            {portals.map((portal) => {
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
          <p className="ff-hint">{t("featureFlags.notConnected")}</p>
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
              disabled={!flag.wired || tableMissing}
              title={flag.wired ? undefined : t("featureFlags.notConnected")}
              onClick={() => setPending({ flag, next: !flag.enabled })}
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
}
