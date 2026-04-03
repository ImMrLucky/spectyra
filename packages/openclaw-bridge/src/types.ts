/**
 * Types for the thin OpenClaw bridge — consumed by Angular wizard and CLI helpers.
 * No optimization or provider secrets appear here.
 */

/** Default Local Companion OpenAI-compatible root including `/v1`. */
export const DEFAULT_LOCAL_COMPANION_V1_BASE = "http://127.0.0.1:4111/v1";

export interface OpenClawBridgeOptions {
  /**
   * OpenAI-compatible API root (must include `/v1`).
   * Example: `http://127.0.0.1:4111/v1`
   */
  baseUrl?: string;
  /** Include `spectyra/quality` in generated provider models list. Default true. */
  includeQualityAlias?: boolean;
  /** Agent default primary model id (OpenClaw shape, e.g. `spectyra/smart`). */
  primaryModel?: string;
}

/**
 * Structured OpenClaw `config.json` fragment aligned with `OPENCLAW_CONFIG_JSON`
 * in `@spectyra/integration-metadata`.
 */
export interface OpenClawGeneratedConfig {
  models: {
    providers: {
      spectyra: {
        baseUrl: string;
        /** Placeholder — real auth is your provider key inside Local Companion / Desktop. */
        apiKey: string;
        api: string;
        models: Array<{
          id: string;
          name: string;
          contextWindow: number;
          maxTokens: number;
        }>;
      };
    };
  };
  agents: {
    defaults: {
      model: { primary: string };
    };
  };
}

export type CompanionReachability = "unreachable" | "reachable";

export type CompanionReadiness = "unknown" | "not_ready" | "ready";

/**
 * Result of `GET /health` on Local Companion, normalized for UI.
 * Never includes secrets.
 */
export interface CompanionHealthResponse {
  reachability: CompanionReachability;
  readiness: CompanionReadiness;
  /** When reachable, raw companion status string (typically `ok`). */
  status?: string;
  runMode?: string;
  provider?: string;
  providerConfigured?: boolean;
  companionReady?: boolean;
  licenseKeyPresent?: boolean;
  licenseAllowsFullOptimization?: boolean;
  telemetryMode?: string;
  /** Human-readable diagnostic; safe for display. */
  message?: string;
}

/** OpenAI-style `GET /v1/models` payload fragment. */
export interface CompanionModelsResponse {
  ok: boolean;
  reachability: CompanionReachability;
  modelIds: string[];
  raw?: unknown;
  message?: string;
}

export type OpenClawWizardBlocker =
  | "none"
  | "companion_unreachable"
  | "companion_not_ready"
  | "provider_not_configured";

export interface OpenClawWizardStatus {
  /** Overall wizard-facing state derived from health + models probes. */
  blocker: OpenClawWizardBlocker;
  health: CompanionHealthResponse;
  models: CompanionModelsResponse;
}

export interface SessionMetadataHeaders {
  "X-Spectyra-Session-Id": string;
  "X-Spectyra-Run-Context": string;
  "X-Spectyra-Integration": string;
}

export interface OpenClawInstallGuide {
  title: string;
  privacySummary: string;
  /** Short bullets for ON / OBSERVE / OFF (optimization modes in Local Companion). */
  modeExplanations: { on: string; observe: string; off: string };
  flowSummary: string;
}

/** UI state for connection troubleshooting (no PII). */
export type SpectyraLocalConnectionState =
  | "desktop_unknown"
  | "companion_unreachable"
  | "companion_not_ready"
  | "license_or_account_incomplete"
  | "provider_missing"
  | "ready";
