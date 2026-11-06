import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  PORTAL_SETTINGS,
  getPortalSettingDefinition,
  type PortalSettingDefinition,
} from "../config/portalSettings.js";

dotenv.config();

// The portal_settings table has row-level security with no policies, so only the
// service role can read or write it.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials for portal settings");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SettingRow {
  key: string;
  value: string;
  updated_by_name: string | null;
  updated_at: string;
}

export type PortalSettingSource = "database" | "environment" | "default";

export interface PortalSettingState extends PortalSettingDefinition {
  /** The value in use. */
  value: string;
  /** Where the value in use comes from. */
  source: PortalSettingSource;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface PortalSettingsSnapshot {
  settings: PortalSettingState[];
  /** True when the portal_settings table is missing (migration not applied yet). */
  tableMissing: boolean;
  /** True when stored values could not be read; defaults are being used. */
  loadFailed: boolean;
}

export class PortalSettingsError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

const CACHE_TTL_MS = 30_000;
// Postgres "undefined_table" and PostgREST "table not in schema cache"
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const MAX_LENGTH = 300;
const MAX_LENGTH_MULTILINE = 50_000;

let cache: {
  loadedAt: number;
  rows: Map<string, SettingRow>;
  tableMissing: boolean;
  loadFailed: boolean;
} | null = null;

export function clearPortalSettingsCache(): void {
  cache = null;
}

async function loadRows() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const rows = new Map<string, SettingRow>();
  let tableMissing = false;
  let loadFailed = false;

  const { data, error } = await supabase
    .from("portal_settings")
    .select("key, value, updated_by_name, updated_at");

  if (error) {
    if (error.code && MISSING_TABLE_CODES.has(error.code)) {
      tableMissing = true;
    } else {
      loadFailed = true;
      console.error("Failed to load portal settings, using defaults:", error);
    }
  } else {
    for (const row of (data || []) as SettingRow[]) rows.set(row.key, row);
  }

  // Do not cache a failure for the full TTL: retry soon.
  cache = {
    loadedAt: loadFailed ? Date.now() - CACHE_TTL_MS + 5_000 : Date.now(),
    rows,
    tableMissing,
    loadFailed,
  };
  return cache;
}

/** database value, then environment variable, then the in-code default */
function resolve(
  def: PortalSettingDefinition,
  row: SettingRow | undefined
): { value: string; source: PortalSettingSource } {
  const stored = row?.value?.trim();
  if (stored) return { value: stored, source: "database" };
  const fromEnv = def.envFallback
    ? process.env[def.envFallback]?.trim()
    : undefined;
  if (fromEnv) return { value: fromEnv, source: "environment" };
  return { value: def.defaultValue, source: "default" };
}

function toState(
  def: PortalSettingDefinition,
  row: SettingRow | undefined
): PortalSettingState {
  return {
    ...def,
    ...resolve(def, row),
    updatedAt: row?.updated_at ?? null,
    updatedByName: row?.updated_by_name ?? null,
  };
}

/** Every setting with its value, source and last change (super-admin page). */
export async function getPortalSettingsSnapshot(): Promise<PortalSettingsSnapshot> {
  const { rows, tableMissing, loadFailed } = await loadRows();
  return {
    settings: PORTAL_SETTINGS.map((def) => toState(def, rows.get(def.key))),
    tableMissing,
    loadFailed,
  };
}

/** Value of every setting (sent to every logged-in client). */
export async function getEffectivePortalSettings(): Promise<
  Record<string, string>
> {
  const { rows } = await loadRows();
  return Object.fromEntries(
    PORTAL_SETTINGS.map((def) => [
      def.key,
      resolve(def, rows.get(def.key)).value,
    ])
  );
}

/** Value of one setting. Unknown keys throw (a typo should fail loudly). */
export async function getPortalSetting(key: string): Promise<string> {
  const def = getPortalSettingDefinition(key);
  if (!def) throw new Error(`Unknown portal setting "${key}"`);
  const { rows } = await loadRows();
  return resolve(def, rows.get(key)).value;
}

/**
 * Saves values. Only known settings are accepted. An empty value removes the
 * stored value, so the setting goes back to its environment/default value.
 */
export async function setPortalSettings(
  values: Record<string, unknown>,
  actor: { id: string; name: string }
): Promise<PortalSettingsSnapshot> {
  const toSave: Array<{ key: string; value: string }> = [];
  const toClear: string[] = [];

  for (const [key, raw] of Object.entries(values || {})) {
    const def = getPortalSettingDefinition(key);
    if (!def) throw new PortalSettingsError(`Unknown setting "${key}"`, 400);
    if (typeof raw !== "string") {
      throw new PortalSettingsError(`Setting "${key}" must be text`, 400);
    }
    const value = raw.trim();
    const max = def.multiline ? MAX_LENGTH_MULTILINE : MAX_LENGTH;
    if (value.length > max) {
      throw new PortalSettingsError(
        `Setting "${key}" is longer than ${max} characters`,
        400
      );
    }
    if (value === "") toClear.push(key);
    else toSave.push({ key, value });
  }

  const missingTable = () =>
    new PortalSettingsError(
      "The portal_settings table does not exist yet. Run migration 031_portal_settings.sql on this portal's database.",
      503
    );

  if (toSave.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("portal_settings").upsert(
      toSave.map(({ key, value }) => ({
        key,
        value,
        updated_by: actor.id,
        updated_by_name: actor.name,
        updated_at: now,
      })),
      { onConflict: "key" }
    );
    if (error) {
      if (error.code && MISSING_TABLE_CODES.has(error.code))
        throw missingTable();
      console.error("Failed to save portal settings:", error);
      throw new PortalSettingsError("Failed to save portal settings", 500);
    }
  }

  if (toClear.length > 0) {
    const { error } = await supabase
      .from("portal_settings")
      .delete()
      .in("key", toClear);
    if (error) {
      if (error.code && MISSING_TABLE_CODES.has(error.code))
        throw missingTable();
      console.error("Failed to clear portal settings:", error);
      throw new PortalSettingsError("Failed to save portal settings", 500);
    }
  }

  clearPortalSettingsCache();
  return getPortalSettingsSnapshot();
}

/**
 * Synchronous read for code that cannot await (for example building an email sender
 * name). Uses the values loaded most recently (at most ~30 seconds old) and refreshes
 * them in the background. Before the first load finishes it returns the environment
 * variable / default value, exactly what the code used before settings existed.
 */
export function getPortalSettingSync(key: string): string {
  const def = getPortalSettingDefinition(key);
  if (!def) throw new Error(`Unknown portal setting "${key}"`);
  if (!cache || Date.now() - cache.loadedAt >= CACHE_TTL_MS) {
    void loadRows().catch(() => undefined);
  }
  return resolve(def, cache?.rows.get(key)).value;
}

/** Loads the settings once at server start so the synchronous reader is warm. */
export async function warmPortalSettings(): Promise<void> {
  await loadRows();
}
