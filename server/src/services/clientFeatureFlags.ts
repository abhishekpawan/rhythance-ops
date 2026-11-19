import { getFeatureFlagSnapshot } from "./featureFlags.js";

/** The flags the browser reads (marked `clientVisible` in the registry), for `GET /api/feature-flags`. */
export async function getClientFlags(): Promise<Record<string, boolean>> {
  const { flags } = await getFeatureFlagSnapshot();
  return Object.fromEntries(
    flags.filter((f) => f.clientVisible).map((f) => [f.key, f.enabled])
  );
}
