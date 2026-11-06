import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  FEATURE_FLAGS,
  getFeatureFlagDefinition,
  type FeatureFlagDefinition,
} from "../config/featureFlags.js";

dotenv.config();

// The feature_flags table has row-level security with no policies, so only the
// service role can read or write it. (utils/supabaseClient.ts uses the anon
// key, which RLS correctly blocks and which would silently read zero rows.)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials for feature flags");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FlagOverrideRow {
  key: string;
  enabled: boolean;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export type FeatureFlagSource = "default" | "override";

export interface FeatureFlagState extends FeatureFlagDefinition {
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

const CACHE_TTL_MS = 30_000;
// Postgres "undefined_table" and PostgREST "table not in schema cache"
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

let cache: {
  loadedAt: number;
  overrides: Map<string, FlagOverrideRow>;
  tableMissing: boolean;
  loadFailed: boolean;
} | null = null;

export function clearFeatureFlagCache(): void {
  cache = null;
}

async function loadOverrides() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const overrides = new Map<string, FlagOverrideRow>();
  let tableMissing = false;
  let loadFailed = false;

  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, updated_by, updated_by_name, updated_at");

  if (error) {
    if (error.code && MISSING_TABLE_CODES.has(error.code)) {
      tableMissing = true;
    } else {
      loadFailed = true;
      console.error("Failed to load feature flags, using defaults:", error);
    }
  } else {
    for (const row of (data || []) as FlagOverrideRow[]) {
      overrides.set(row.key, row);
    }
  }

  // Do not cache a failure for the full TTL: retry soon.
  cache = {
    loadedAt: loadFailed ? Date.now() - CACHE_TTL_MS + 5_000 : Date.now(),
    overrides,
    tableMissing,
    loadFailed,
  };
  return cache;
}

function toState(
  def: FeatureFlagDefinition,
  override: FlagOverrideRow | undefined
): FeatureFlagState {
  return {
    ...def,
    enabled: override ? override.enabled : def.defaultEnabled,
    source: override ? "override" : "default",
    updatedAt: override?.updated_at ?? null,
    updatedByName: override?.updated_by_name ?? null,
  };
}

/** Full state of every registered flag (used by the super-admin page). */
export async function getFeatureFlagSnapshot(): Promise<FeatureFlagSnapshot> {
  const { overrides, tableMissing, loadFailed } = await loadOverrides();
  return {
    flags: FEATURE_FLAGS.map((def) => toState(def, overrides.get(def.key))),
    tableMissing,
    loadFailed,
  };
}

/** Effective on/off value for every flag (sent to every logged-in client). */
export async function getEffectiveFlags(): Promise<Record<string, boolean>> {
  const { flags } = await getFeatureFlagSnapshot();
  return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
}

/** Server-side check. Unknown keys are always off. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const def = getFeatureFlagDefinition(key);
  if (!def) return false;
  const { overrides } = await loadOverrides();
  const override = overrides.get(key);
  return override ? override.enabled : def.defaultEnabled;
}

export class FeatureFlagError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  actor: { id: string; name: string }
): Promise<FeatureFlagState> {
  const def = getFeatureFlagDefinition(key);
  if (!def) throw new FeatureFlagError(`Unknown feature flag "${key}"`, 404);

  const { error } = await supabase.from("feature_flags").upsert(
    {
      key,
      enabled,
      updated_by: actor.id,
      updated_by_name: actor.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    if (error.code && MISSING_TABLE_CODES.has(error.code)) {
      throw new FeatureFlagError(
        "The feature_flags table does not exist yet. Run migration 029_feature_flags.sql on this portal's database.",
        503
      );
    }
    console.error("Failed to save feature flag:", error);
    throw new FeatureFlagError("Failed to save feature flag", 500);
  }

  clearFeatureFlagCache();
  const { overrides } = await loadOverrides();
  return toState(def, overrides.get(key));
}

/** Removes the override so the flag goes back to its in-code default. */
export async function resetFeatureFlag(key: string): Promise<FeatureFlagState> {
  const def = getFeatureFlagDefinition(key);
  if (!def) throw new FeatureFlagError(`Unknown feature flag "${key}"`, 404);

  const { error } = await supabase
    .from("feature_flags")
    .delete()
    .eq("key", key);

  if (error) {
    if (error.code && MISSING_TABLE_CODES.has(error.code)) {
      throw new FeatureFlagError(
        "The feature_flags table does not exist yet. Run migration 029_feature_flags.sql on this portal's database.",
        503
      );
    }
    console.error("Failed to reset feature flag:", error);
    throw new FeatureFlagError("Failed to reset feature flag", 500);
  }

  clearFeatureFlagCache();
  return toState(def, undefined);
}
