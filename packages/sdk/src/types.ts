/**
 * Spectyra SDK Types
 *
 * Core types for SDK-first agentic integration.
 * Uses shared platform types from @spectyra/core-types.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  ProviderBillingOwner,
  IntegrationType,
  SavingsReport,
  PromptComparison,
  SecurityLabels,
} from "@spectyra/core-types";
import type { WorkflowPolicyMode } from "@spectyra/workflow-policy";
import type { GlobalLearningSnapshot, LearningProfile } from "@spectyra/canonical-model";
import type { ResolveSpectyraModelInput } from "@spectyra/shared";
import type { SpectyraEntitlementStatus, SpectyraMetricsSnapshot, SpectyraQuotaStatus } from "./observability/observabilityTypes.js";

// Re-export core-types so downstream consumers only need @spectyra/sdk
export type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  ProviderBillingOwner,
  IntegrationType,
  SavingsReport,
  PromptComparison,
  SecurityLabels,
};

// ============================================================================
// New unified configuration (local-first, direct-provider)
// ============================================================================

/**
 * @deprecated Use SpectyraRunMode instead
 */
export type SpectyraMode = "local" | "api";

/**
 * @public
 * Log verbosity for in-app / dashboard SDK (console + optional custom logger).
 */
export type SpectyraLogLevel = "silent" | "error" | "warn" | "info" | "debug";

/**
 * @public
 * Floating devtools panel (browser / DOM only; no-op in Node when disabled).
 */
export interface SpectyraDevtoolsConfig {
  /**
   * When `false`, no devtools UI is mounted. In browser runtimes, defaults to `true`
   * unless you set it to `false` here.
   */
  enabled?: boolean;
  /** When `true` (default), the floating panel or pill is available. */
  floatingPanel?: boolean;
  /**
   * When `true` (default), the compact card is shown on first mount.
   * When `false`, only the minimized pill is shown until the user opens it.
   */
  defaultOpen?: boolean;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

/**
 * @public
 * Runtime entitlement / quota refresh for upgrade-without-redeploy.
 */
export interface SpectyraEntitlementsConfig {
  /**
   * When `false`, no `GET /v1/entitlements/status` polling. Default: `true` when
   * a Spectyra API key and API base URL can be resolved; otherwise `false`.
   */
  enabled?: boolean;
  /** Polling interval in ms. Default: 120_000. */
  refreshIntervalMs?: number;
  /**
   * API base including `/v1` (e.g. `https://api.example.com/v1`).
   * Default: `config.spectyraApiBaseUrl` or `SPECTYRA_API_BASE_URL`.
   */
  baseUrl?: string;
}

// Forward declarations for events (concrete shapes below import SpectyraConfig consumers may extend)

/** @public */
export interface SpectyraRequestStartEvent {
  runId: string;
  provider: string;
  model: string;
  runMode: import("@spectyra/core-types").SpectyraRunMode;
}

/** @public */
export interface SpectyraRequestEndEvent {
  runId: string;
  provider: string;
  model: string;
  /** Wall-clock time for the Spectyra-wrapped `complete()` call, ms. */
  durationMs: number;
}

/** @public */
export interface SpectyraOptimizationEvent {
  runId: string;
  runMode: import("@spectyra/core-types").SpectyraRunMode;
  transformsApplied: string[];
  inputTokensBefore: number;
  inputTokensAfter: number;
}

/**
 * @public
 * Payload for {@link SpectyraConfig.onCostCalculated} (aggregated costs from the local pricing estimator — never raw prompts).
 */
export interface SpectyraCostCalculatedPayload {
  runId: string;
  provider: string;
  model: string;
  costBefore: number;
  costAfter: number;
  savingsAmount: number;
  savingsPercent: number;
}

/**
 * @public
 * @deprecated Prefer {@link SpectyraCostCalculatedPayload}; kept for older typings.
 */
export type SpectyraSavingsCalculation = SpectyraCostCalculatedPayload | Record<string, unknown>;

export interface SpectyraConfig {
  /**
   * Run mode: `off` (passthrough) or `on` (run the optimizer; application still depends on license / entitlements).
   * Default when omitted: `"on"`. For account limits, use `GET /v1/entitlements/status` + `getQuotaStatus()`—the SDK
   * may switch to effective passthrough (same as `runMode: "off"` for optimization) without a second mode.
   */
  runMode?: SpectyraRunMode;

  /**
   * Telemetry settings
   */
  telemetry?: { mode: TelemetryMode };

  /**
   * Prompt snapshot storage mode
   */
  promptSnapshots?: PromptSnapshotMode;

  /**
   * Spectyra license key for entitlement checks and optional cloud sync.
   * NOT a provider key — provider keys are supplied per-call or via env.
   */
  licenseKey?: string;

  /**
   * Spectyra **dashboard** API key (same as `X-SPECTYRA-API-KEY` in the HTTP API).
   * When `telemetry.mode` is `"cloud_redacted"`, each `complete()` POSTs aggregated usage to
   * `POST {spectyraApiBaseUrl}/telemetry/run`. Also reads `SPECTYRA_CLOUD_API_KEY` or `SPECTYRA_API_KEY` when omitted.
   */
  spectyraCloudApiKey?: string;

  /**
   * API base URL **including** `/v1`, e.g. `https://your-api.example.com/v1`.
   * Defaults to `process.env.SPECTYRA_API_BASE_URL` for cloud telemetry when set.
   */
  spectyraApiBaseUrl?: string;

  /**
   * Phase 5 — optional local learning profile (mutated in place when present).
   * Use `createEmptyProfile` from `@spectyra/learning` and reuse across `complete()` calls.
   */
  learningProfile?: LearningProfile;

  /** Optional aggregate benchmarks (non-sensitive); tune detector thresholds with local profile. */
  globalLearningSnapshot?: GlobalLearningSnapshot;

  /**
   * Phase 6 — workflow policy (same engine as Local Companion / Desktop embedded companion).
   * - `observe`: evaluate only; never blocks the provider.
   * - `enforce`: `complete()` throws `WorkflowPolicyBlockedError` before `adapter.call` when rules trip.
   * Omit to disable (no policy checks).
   */
  workflowPolicy?: { mode: WorkflowPolicyMode };

  /**
   * Optional tier overrides for `spectyra/*` model ids (same resolution as Local Companion).
   * When the request `model` is a Spectyra alias, missing fields default from
   * `defaultAliasModels(provider)` for `complete()`'s `provider` string.
   */
  spectyraModelAliasOverrides?: Partial<
    Pick<ResolveSpectyraModelInput, "aliasSmartModel" | "aliasFastModel" | "aliasQualityModel" | "providerTierModels">
  >;

  /**
   * In-app / dashboard: structured logging (in addition to optional hooks).
   * - `true` enables at least `info`+ for development when `logLevel` is omitted.
   */
  debug?: boolean;
  logLevel?: SpectyraLogLevel;
  /**
   * Override console for tests or structured log sinks.
   * Defaults to global `console` (subset used only).
   */
  logger?: Pick<Console, "log" | "warn" | "error" | "debug">;

  /**
   * Browser-only floating devtools. Defaults to on in `typeof window` environments when not disabled.
   * Server-side / Node: never mounts UI.
   */
  devtools?: SpectyraDevtoolsConfig;

  /**
   * Polling and runtime entitlements. Upgrade in the web app; SDK picks it up here without redeploy.
   */
  entitlements?: SpectyraEntitlementsConfig;

  onRequestStart?: (event: SpectyraRequestStartEvent) => void;
  onRequestEnd?: (event: SpectyraRequestEndEvent) => void;
  onOptimization?: (event: SpectyraOptimizationEvent) => void;
  onMetrics?: (metrics: SpectyraMetricsSnapshot) => void;
  onQuota?: (quota: SpectyraQuotaStatus) => void;
  onEntitlementChange?: (entitlement: SpectyraEntitlementStatus) => void;
  onCostCalculated?: (result: SpectyraCostCalculatedPayload) => void;
  onPricingStale?: (info: { version: string; fetchedAt: string; stale: boolean }) => void;

  // --- Legacy fields (deprecated, kept for backward compat) ---

  /**
   * @deprecated Use runMode instead.
   * `"local"` maps to runMode `"on"`, `"api"` maps to legacy remote gateway.
   */
  mode?: SpectyraMode;

  /**
   * @deprecated Spectyra API endpoint (only for legacy remote gateway mode)
   */
  endpoint?: string;

  /**
   * @deprecated Spectyra API key (only for legacy remote gateway mode)
   */
  apiKey?: string;

  /**
   * Default settings for agent decision engine (legacy)
   */
  defaults?: {
    budgetUsd?: number;
    models?: {
      small?: string;
      medium?: string;
      large?: string;
    };
  };
}

// ============================================================================
// New complete() API types
// ============================================================================

/**
 * Input to spectyra.complete() — wraps a provider call with optimization.
 */
export interface SpectyraCompleteInput<TClient = unknown> {
  provider: string;
  client: TClient;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  runContext?: {
    /**
     * Per-request id for `report.runId` and `onRequestStart` / `onRequestEnd` hooks.
     * If omitted, a random UUID is generated in `localComplete()`.
     */
    runId?: string;
    /** Correlate multiple `complete()` calls with a shared workflow session (optional). */
    sessionId?: string;
    appType?: string;
    appName?: string;
    workflowType?: string;
    /** Logical service for rollups (e.g. `api`, `worker`). */
    service?: string;
    /** Opaque correlation id (no PII). */
    traceId?: string;
    /** Project name or UUID for cloud telemetry (required when the API key is org-wide). */
    project?: string;
    /** Deployment environment (e.g. `production`, `staging`). Defaults to `process.env.NODE_ENV`. */
    environment?: string;
    /**
     * When `false`, `complete()` does not emit normalized SDK events (used by `startSpectyraSession`,
     * which emits session/step events itself). Default: emit for standalone `complete()` calls.
     */
    emitNormalizedEvents?: boolean;
  };
}

/**
 * Output from spectyra.complete() — provider result + Spectyra metadata.
 */
export interface SpectyraCompleteResult<TProviderResult = unknown> {
  providerResult?: TProviderResult;
  report: SavingsReport;
  promptComparison?: PromptComparison;

  /**
   * Flow optimization signals from the spectral analysis pipeline.
   * Contains: stability index, contradiction detection, stuck-loop
   * detection, clarification suggestions, path detection.
   */
  flowSignals?: import("@spectyra/canonical-model").FlowSignals | null;

  /**
   * True when the user has no valid trial or paid license.
   * The full pipeline ran so the user can SEE projected savings,
   * but zero optimization was applied. Show an activation prompt.
   */
  licenseLimited?: boolean;

  /** Current license status: "active", "observe_only", or "unknown". */
  licenseStatus?: import("@spectyra/canonical-model").LicenseStatus;

  /** Token savings the user would get if they activated. Set when licenseLimited = true. */
  projectedSavingsIfActivated?: number;

  security: {
    inferencePath: InferencePath;
    providerBillingOwner: ProviderBillingOwner;
    telemetryMode: TelemetryMode;
    promptSnapshotMode: PromptSnapshotMode;
    cloudRelay: "none" | "analytics_only";
  };
}

/**
 * A provider adapter that knows how to call a specific provider SDK.
 * Implemented for OpenAI, Anthropic, Groq, etc.
 */
export interface ProviderAdapter<TClient = unknown, TResult = unknown> {
  readonly providerName: string;
  call(args: {
    client: TClient;
    model: string;
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    result: TResult;
    text: string;
    usage: { inputTokens: number; outputTokens: number };
  }>;
}

// ============================================================================
// Legacy context / meta types (still used by agentOptions)
// ============================================================================

export interface SpectyraCtx {
  orgId?: string;
  projectId?: string;
  runId?: string;
  budgetUsd?: number;
  tags?: Record<string, string>;
}

export interface PromptMeta {
  promptChars: number;
  path?: "code" | "talk";
  repoId?: string;
  language?: string;
  filesChanged?: number;
  testCommand?: string;
}

// ============================================================================
// Remote API Types (legacy)
// ============================================================================

export interface AgentOptionsRequest {
  run_id?: string;
  prompt_meta: PromptMeta;
  preferences?: {
    budgetUsd?: number;
    allowTools?: string[];
  };
}

export interface AgentOptionsResponse {
  run_id: string;
  options: ClaudeAgentOptions;
  reasons: string[];
}

export interface AgentEventRequest {
  run_id: string;
  event: unknown;
}

export interface AgentEventResponse {
  ok: boolean;
}

// ============================================================================
// Legacy Types (for backwards compatibility)
// ============================================================================

import type { Path, Mode, ChatMessage, Usage, ClaudeAgentOptions, AgentDecision } from "./sharedTypes.js";

export type { Path, Mode, ChatMessage, Usage, ClaudeAgentOptions, AgentDecision };

export interface ChatResponse {
  id: string;
  created_at: string;
  mode: Mode;
  path: Path;
  optimization_level: number;
  provider: string;
  model: string;
  response_text: string;
  usage: Usage;
  cost_usd: number;
  savings?: {
    savings_type: "verified" | "estimated" | "shadow_verified";
    tokens_saved: number;
    pct_saved: number;
    cost_saved_usd: number;
    confidence_band?: "high" | "medium" | "low";
  };
  quality?: {
    pass: boolean;
    failures: string[];
  };
}

/**
 * @deprecated Use createSpectyra() with the new config shape instead
 */
export interface SpectyraClientConfig {
  apiUrl: string;
  spectyraKey: string;
  provider: string;
  providerKey: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  path: Path;
  optimization_level?: number;
  conversation_id?: string;
  dry_run?: boolean;
}
