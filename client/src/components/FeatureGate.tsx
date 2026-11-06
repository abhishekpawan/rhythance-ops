import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";

interface FeatureGateProps {
  /** Feature flag key. */
  flag: string;
  /** Value to use if the flags cannot be loaded (use the flag's default). */
  defaultEnabled?: boolean;
  children: ReactNode;
  /** Shown while flags load, so a switched-off page never flashes. */
  loadingFallback?: ReactNode;
}

/**
 * Renders its children only when the feature flag is on for this portal. When the
 * flag is off the visitor is sent to the same place as for any unknown address.
 */
export function FeatureGate({
  flag,
  defaultEnabled = false,
  children,
  loadingFallback = null,
}: FeatureGateProps) {
  const { ready, isEnabled } = useFeatureFlags();

  if (!ready) return <>{loadingFallback}</>;
  if (!isEnabled(flag, defaultEnabled)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
