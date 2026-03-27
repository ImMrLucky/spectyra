/**
 * Normalized local event model — all adapters emit SpectyraEvent.
 */

import type { PromptSnapshotMode, TelemetryMode } from "@spectyra/core-types";

export type SpectyraEventType =
  | "session_started"
  | "step_started"
  | "step_completed"
  | "tool_called"
  | "tool_result"
  | "optimization_simulated"
  | "optimization_applied"
  | "provider_request_started"
  | "provider_request_completed"
  | "prompt_comparison_available"
  | "session_finished"
  | "sync_state_changed"
  | "error";

/** Source integration — adapter id + classification (no vendor logic in core). */
export type SpectyraEventIntegrationType =
  | "sdk-wrapper"
  | "local-companion"
  | "openclaw-jsonl"
  | "claude-hooks"
  | "claude-jsonl"
  | "openai-tracing"
  | "generic-jsonl"
  | "unknown";

export type SpectyraEvent = {
  id: string;
  type: SpectyraEventType;
  timestamp: string;

  source: {
    adapterId: string;
    integrationType: SpectyraEventIntegrationType;
    toolName?: string;
    toolVersion?: string;
  };

  sessionId: string;
  runId: string;
  stepId?: string;

  appName?: string;
  workflowType?: string;
  provider?: string;
  model?: string;

  payload: Record<string, unknown>;

  security: {
    telemetryMode: TelemetryMode;
    promptSnapshotMode: PromptSnapshotMode;
    localOnly: boolean;
    containsPromptContent?: boolean;
    containsResponseContent?: boolean;
  };
};

export type AdapterContext = {
  sessionId?: string;
  runId?: string;
  stepId?: string;
  appName?: string;
  workflowType?: string;
};
