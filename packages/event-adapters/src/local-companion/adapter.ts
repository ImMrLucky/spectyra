/**
 * Local Companion / desktop runtime payloads.
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import type { SavingsReport } from "@spectyra/core-types";
import { defaultSecurity, newId } from "../helpers.js";

export type CompanionV1Payload = {
  kind: "spectyra.companion.v1";
  phase: "session_start" | "chat_completed" | "session_end";
  sessionId: string;
  runId: string;
  stepId?: string;
  report?: SavingsReport;
};

export const localCompanionEventAdapter: SpectyraEventAdapter<CompanionV1Payload> = {
  id: "spectyra.companion.v1",
  integrationType: "local-companion",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as CompanionV1Payload).kind === "spectyra.companion.v1"
    );
  },
  ingest(input: CompanionV1Payload, _ctx?: AdapterContext): SpectyraEvent[] {
    const sec = defaultSecurity(input.report?.telemetryMode, input.report?.promptSnapshotMode);
    const base = {
      source: { adapterId: localCompanionEventAdapter.id, integrationType: "local-companion" as const },
      sessionId: input.sessionId,
      runId: input.runId,
      stepId: input.stepId,
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
    if (input.phase === "chat_completed" && input.report) {
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
