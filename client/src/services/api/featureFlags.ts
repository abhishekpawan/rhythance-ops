import axios from "axios";
import { api, clearCacheFor } from "./index";

export type FeatureFlagCategory =
  | "dashboard"
  | "positions"
  | "jobseeker_profile"
  | "admin";

export type PortalId = "godspeed" | "gdworkforce" | "canhire" | "allstaff";

export interface FeatureFlagAdminItem {
  key: string;
  title: string;
  description: string;
  category: FeatureFlagCategory;
  defaultEnabled: boolean;
  /** True once application code reads this flag. */
  wired: boolean;
  /** Intended state per portal (documentation / tracking). */
  intended: Partial<Record<PortalId, boolean>>;
  notes?: string;
  enabled: boolean;
  source: "default" | "override";
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface FeatureFlagsAdminResponse {
  flags: FeatureFlagAdminItem[];
  portals: Array<{ id: PortalId; label: string }>;
  /** Migration 029 has not been applied to this portal's database yet. */
  tableMissing: boolean;
  /** Overrides could not be read; defaults are being used. */
  loadFailed: boolean;
}

function toError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  return error instanceof Error ? error : new Error(fallback);
}

/** Effective on/off value of every flag (any logged-in user). */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const { data } = await api.get("/api/feature-flags");
    return data.flags as Record<string, boolean>;
  } catch (error) {
    throw toError(error, "Failed to load feature flags");
  }
}

/** Full registry and state (super admin only). */
export async function getFeatureFlagsAdmin(): Promise<FeatureFlagsAdminResponse> {
  try {
    const { data } = await api.get("/api/feature-flags/admin");
    return data as FeatureFlagsAdminResponse;
  } catch (error) {
    throw toError(error, "Failed to load feature flags");
  }
}

export async function setFeatureFlagValue(
  key: string,
  enabled: boolean
): Promise<FeatureFlagAdminItem> {
  try {
    const { data } = await api.put(`/api/feature-flags/${key}`, { enabled });
    clearCacheFor("/api/feature-flags");
    return data.flag as FeatureFlagAdminItem;
  } catch (error) {
    throw toError(error, "Failed to update feature flag");
  }
}

export async function resetFeatureFlagValue(
  key: string
): Promise<FeatureFlagAdminItem> {
  try {
    const { data } = await api.delete(`/api/feature-flags/${key}`);
    clearCacheFor("/api/feature-flags");
    return data.flag as FeatureFlagAdminItem;
  } catch (error) {
    throw toError(error, "Failed to reset feature flag");
  }
}
