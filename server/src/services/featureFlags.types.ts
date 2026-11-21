import type { FeatureFlagDefinition } from "../config/featureFlags.js";

export interface FlagOverrideRow {
  key: string;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export type FeatureFlagSource = "default" | "override";

export interface FeatureFlagSettingState {
  key: string;
  label: string;
  description?: string;
  defaultValue: string;
  /** The value in use: the database value if set, otherwise the default. */
  value: string;
  source: "database" | "default";
}

export interface FeatureFlagState extends FeatureFlagDefinition {
  /** Effective value of each setting (only for flags that define settings). */
  settingValues: FeatureFlagSettingState[];
  enabled: boolean;
  source: FeatureFlagSource;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface FeatureFlagSnapshot {
  flags: FeatureFlagState[];
  /** True when the feature_flags table is missing (migration not applied yet). */
  tableMissing: boolean;
  /** True when overrides could not be read; defaults are being used. */
  loadFailed: boolean;
}

export class FeatureFlagError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
