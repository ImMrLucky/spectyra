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
import type { GlobalLearningSnapshot, LearningProfile } from "@spectyra/canonical-model";

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

export interface SpectyraConfig {
  /**
   * Run mode: off | observe | on
   * Default when omitted: "on" (optimization when licensed; use "observe" for dry-run / projected savings).
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
   * Phase 5 — optional local learning profile (mutated in place when present).
   * Use `createEmptyProfile` from `@spectyra/learning` and reuse across `complete()` calls.
   */
  learningProfile?: LearningProfile;

  /** Optional aggregate benchmarks (non-sensitive); tune detector thresholds with local profile. */
  globalLearningSnapshot?: GlobalLearningSnapshot;

  // --- Legacy fields (deprecated, kept for backward compat) ---

  /**
   * @deprecated Use runMode instead.
   * "local" maps to runMode "observe", "api" maps to legacy remote gateway.
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
    /** Correlate multiple `complete()` calls with a shared workflow session (optional). */
    sessionId?: string;
    appType?: string;
    appName?: string;
    workflowType?: string;
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
