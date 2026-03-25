/**
 * Canonical request schema.
 *
 * Every external request (OpenAI, Anthropic, local companion, agent harness)
 * is adapted into this form before it reaches the optimization engine.
 * The engine never sees vendor-specific shapes.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  IntegrationType,
} from "@spectyra/core-types";

// ── Content parts ────────────────────────────────────────────────────────────

export type CanonicalContentPart =
  | { type: "text"; text: string }
  | { type: "code"; language?: string; content: string }
  | { type: "json"; content: unknown }
  | { type: "file_ref"; id: string; label?: string; sizeBytes?: number }
  | { type: "image_ref"; id: string; label?: string }
  | { type: "summary_ref"; id: string; summary: string };

// ── Messages ─────────────────────────────────────────────────────────────────

export type CanonicalMessageRole = "system" | "user" | "assistant" | "tool";

export interface CanonicalMessage {
  role: CanonicalMessageRole;
  text?: string;
  parts?: CanonicalContentPart[];
  /** Tool name or participant name, when applicable. */
  name?: string;
  metadata?: Record<string, unknown>;
}

// ── Tools ────────────────────────────────────────────────────────────────────

export interface CanonicalToolDefinition {
  id: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  metadata?: Record<string, unknown>;
}

export interface CanonicalToolResult {
  toolName: string;
  callId?: string;
  success: boolean;
  outputText?: string;
  outputJson?: unknown;
  metadata?: Record<string, unknown>;
}

// ── Context bundles ──────────────────────────────────────────────────────────

export type ContextBundleKind =
  | "history"
  | "file"
  | "retrieval"
  | "memory"
  | "summary"
  | "tool_output"
  | "other";

export interface CanonicalContextBundle {
  id: string;
  kind: ContextBundleKind;
  label?: string;
  content: CanonicalContentPart[];
  metadata?: {
    source?: string;
    repeated?: boolean;
    priority?: number;
    tokenEstimate?: number;
  };
}

// ── Execution metadata ───────────────────────────────────────────────────────

export interface CanonicalExecutionMetadata {
  appName?: string;
  appVersion?: string;
  workflowType?: string;
  stepIndex?: number;
  totalKnownSteps?: number | null;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  isAgenticFlow?: boolean;
  isMultiStepFlow?: boolean;
}

// ── Policy hints ─────────────────────────────────────────────────────────────

export type DesiredOutputShape =
  | "freeform"
  | "json"
  | "markdown"
  | "code"
  | "tool_call";

export interface CanonicalPolicyHints {
  desiredOutputShape?: DesiredOutputShape;
  prioritizeDeterminism?: boolean;
  prioritizeCompression?: boolean;
  prioritizeLatency?: boolean;
  keepRecentTurns?: number;
  preserveExactSections?: string[];
}

// ── Security metadata ────────────────────────────────────────────────────────

export interface CanonicalSecurityMetadata {
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  containsSensitiveContent?: boolean;
  allowCloudSync?: boolean;

  /**
   * When true, ALL processing (optimization, feature detection, flow analysis)
   * MUST happen in-process. No message content, prompts, or code may be sent
   * to any external server including Spectyra infrastructure.
   *
   * Default: true for SDK, desktop, and companion integrations.
   */
  localOnly?: boolean;

  /**
   * Explicit data safety contract. When "never", no customer content
   * (prompts, messages, code) may leave the customer's environment under
   * any circumstance. Anonymous usage metrics (token counts, transform IDs,
   * latency) may still be reported if telemetryMode allows.
   */
  contentExfiltration?: "never" | "analytics_only";
}

// ── Provider hint ────────────────────────────────────────────────────────────

export type ApiStyle = "openai" | "anthropic" | "openai_compatible" | "custom";

export interface CanonicalProviderHint {
  vendor?: string;
  model?: string;
  apiStyle?: ApiStyle;
}

// ── Canonical request ────────────────────────────────────────────────────────

export interface CanonicalRequest {
  requestId: string;
  runId: string;
  mode: SpectyraRunMode;
  integrationType: IntegrationType;

  provider?: CanonicalProviderHint;
  messages: CanonicalMessage[];
  tools?: CanonicalToolDefinition[];
  toolResults?: CanonicalToolResult[];
  context?: CanonicalContextBundle[];

  execution: CanonicalExecutionMetadata;
  policies?: CanonicalPolicyHints;
  security: CanonicalSecurityMetadata;
}
