/**
 * SDK structured payloads → SpectyraEvent (no optimization logic).
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import type { SavingsReport } from "@spectyra/core-types";
import { defaultSecurity, newId } from "../helpers.js";

export type SdkV1Payload = {
  kind: "spectyra.sdk.v1";
  phase: "session_start" | "complete" | "session_end" | "prompt_comparison_available";
  sessionId: string;
  runId: string;
  stepId?: string;
  appName?: string;
  workflowType?: string;
  /** Present when phase === "complete" */
  report?: SavingsReport;
  /** Local reference only (e.g. runId) — no prompt text. */
  promptComparisonRef?: { runId: string; storageMode?: string };
};

export const sdkEventAdapter: SpectyraEventAdapter<SdkV1Payload> = {
  id: "spectyra.sdk.v1",
  integrationType: "sdk-wrapper",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as SdkV1Payload).kind === "spectyra.sdk.v1"
    );
  },
  ingest(input: SdkV1Payload, _ctx?: AdapterContext): SpectyraEvent[] {
    const sec = defaultSecurity(input.report?.telemetryMode, input.report?.promptSnapshotMode);
    const base = {
      source: { adapterId: sdkEventAdapter.id, integrationType: "sdk-wrapper" as const },
      sessionId: input.sessionId,
      runId: input.runId,
      stepId: input.stepId,
      appName: input.appName,
      workflowType: input.workflowType,
      provider: input.report?.provider,
      model: input.report?.model,
      security: sec,
    };

    if (input.phase === "session_start") {
      return [
        {
          id: newId(),
          type: "session_started",
          timestamp: new Date().toISOString(),
          ...base,
          payload: { runMode: input.report?.mode },
        },
      ];
    }

    if (input.phase === "session_end") {
      return [
        {
          id: newId(),
          type: "session_finished",
          timestamp: new Date().toISOString(),
          ...base,
          payload: {},
        },
      ];
    }

    if (input.phase === "prompt_comparison_available") {
      return [
        {
          id: newId(),
          type: "prompt_comparison_available",
          timestamp: new Date().toISOString(),
          ...base,
          payload: {
            runId: input.promptComparisonRef?.runId ?? input.runId,
            storageMode: input.promptComparisonRef?.storageMode,
          },
        },
      ];
    }

    if (input.phase === "complete" && input.report) {
      const r = input.report;
      return [
        {
          id: newId(),
          type: "optimization_applied",
          timestamp: r.createdAt ?? new Date().toISOString(),
          ...base,
          payload: {
            inputTokensBefore: r.inputTokensBefore,
            inputTokensAfter: r.inputTokensAfter,
            transformsApplied: r.transformsApplied,
          },
        },
        {
          id: newId(),
          type: "provider_request_completed",
          timestamp: r.createdAt ?? new Date().toISOString(),
          ...base,
          payload: {
            inputTokens: r.inputTokensAfter,
            outputTokens: r.outputTokens,
            success: r.success !== false,
          },
        },
      ];
    }

    return [];
  },
};
