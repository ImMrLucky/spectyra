/**
 * Security labels model.
 *
 * Every relevant UI surface (Studio, Observe, Desktop App, SDK output)
 * should expose these labels so users can verify the security posture
 * at a glance.
 */

import type {
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  ProviderBillingOwner,
} from "./modes.js";

/**
 * Security labels rendered on every run / page.
 */
export interface SecurityLabels {
  inferencePath: InferencePath;
  providerBillingOwner: ProviderBillingOwner;
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  cloudRelay: "none" | "analytics_only";
}

/**
 * Secure defaults applied when no explicit config is provided.
 */
export const SECURITY_DEFAULTS: Readonly<SecurityLabels> = {
  inferencePath: "direct_provider",
  providerBillingOwner: "customer",
  telemetryMode: "local",
  promptSnapshotMode: "local_only",
  cloudRelay: "none",
} as const;
