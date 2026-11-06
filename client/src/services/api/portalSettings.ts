import axios from "axios";
import { api, clearCacheFor } from "./index";

export type PortalSettingGroup =
  | "portal"
  | "email"
  | "company"
  | "branding"
  | "training";

export type PortalSettingSource = "database" | "environment" | "default";

export interface PortalSettingItem {
  key: string;
  group: PortalSettingGroup;
  label: string;
  description?: string;
  defaultValue: string;
  multiline?: boolean;
  /** The value in use. */
  value: string;
  /** Where the value in use comes from. */
  source: PortalSettingSource;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface PortalSettingsAdminResponse {
  settings: PortalSettingItem[];
  /** Migration 031 has not been applied to this portal's database yet. */
  tableMissing: boolean;
  /** Stored values could not be read; defaults are being used. */
  loadFailed: boolean;
}

function toError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  return error instanceof Error ? error : new Error(fallback);
}

/** Value of every setting (any logged-in user). */
export async function getPortalSettings(): Promise<Record<string, string>> {
  try {
    const { data } = await api.get("/api/portal-settings");
    return data.values as Record<string, string>;
  } catch (error) {
    throw toError(error, "Failed to load portal settings");
  }
}

/** Every setting with its source (super admin only). */
export async function getPortalSettingsAdmin(): Promise<PortalSettingsAdminResponse> {
  try {
    const { data } = await api.get("/api/portal-settings/admin");
    return data as PortalSettingsAdminResponse;
  } catch (error) {
    throw toError(error, "Failed to load portal settings");
  }
}

/** Saves values. An empty value removes the stored value (back to the default). */
export async function savePortalSettings(
  values: Record<string, string>
): Promise<PortalSettingsAdminResponse> {
  try {
    const { data } = await api.put("/api/portal-settings", { values });
    clearCacheFor("/api/portal-settings");
    return data as PortalSettingsAdminResponse;
  } catch (error) {
    throw toError(error, "Failed to save portal settings");
  }
}
