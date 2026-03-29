/**
 * Shared runtime configuration shape.
 *
 * Used by the SDK `createSpectyra()`, the Local Companion, and
 * the Desktop App onboarding wizard so all surfaces share one config model.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
} from "./modes.js";

/**
 * Unified runtime config accepted by all Spectyra surfaces.
 */
export interface SpectyraRuntimeConfig {
  runMode: SpectyraRunMode;
  telemetry: { mode: TelemetryMode };
  promptSnapshots: PromptSnapshotMode;

  /** Spectyra license key for entitlement checks and optional cloud sync */
  licenseKey?: string;

  /**
   * Provider configuration (for SDK / Local Companion).
   * The Website App does not need this — it uses BYOK headers.
   */
  provider?: {
    name: string;
    model?: string;
    apiKey?: string;
    keySource?: "env" | "session" | "encrypted_local_store";
  };

  /** Local Companion bind settings */
  companion?: {
    bindHost?: string;
    port?: number;
  };

  /** Run context metadata */
  runContext?: {
    appType?: string;
    appName?: string;
    workflowType?: string;
  };
}

/**
 * Default runtime config — local-first; matches SDK/companion default run mode when unset.
 */
export const DEFAULT_RUNTIME_CONFIG: Readonly<SpectyraRuntimeConfig> = {
  runMode: "on",
  telemetry: { mode: "local" },
  promptSnapshots: "local_only",
  companion: {
    bindHost: "127.0.0.1",
    port: 4111,
  },
} as const;
