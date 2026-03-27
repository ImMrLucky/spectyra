/**
 * Normalized local event pipeline — same model as Local Companion (via adapters).
 */

import { createEventIngestionEngine } from "@spectyra/event-core";
import { sdkEventAdapter } from "@spectyra/event-adapters";
import type {
  PromptSnapshotMode,
  SavingsReport,
  SpectyraRunMode,
  TelemetryMode,
} from "@spectyra/core-types";
import type { SpectyraCompleteInput, SpectyraCompleteResult } from "../types.js";

export const sdkEventEngine = createEventIngestionEngine({
  adapters: [sdkEventAdapter],
  dedupe: true,
});

/** Emit normalized events when telemetry is not fully disabled. */
export function shouldEmitSdkNormalizedEvents(telemetryMode: TelemetryMode | undefined): boolean {
  return telemetryMode !== "off";
}

function minimalReportForSessionStart(
  runId: string,
  mode: SpectyraRunMode,
  telemetryMode: TelemetryMode,
  promptSnapshotMode: PromptSnapshotMode,
): SavingsReport {
  return {
    runId,
    mode,
    integrationType: "sdk-wrapper",
    provider: "",
    model: "",
    inputTokensBefore: 0,
    inputTokensAfter: 0,
    outputTokens: 0,
    estimatedCostBefore: 0,
    estimatedCostAfter: 0,
    estimatedSavings: 0,
    estimatedSavingsPct: 0,
    telemetryMode,
    promptSnapshotMode,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: [],
  };
}

export function ingestSdkSessionStart(input: {
  sessionId: string;
  runId: string;
  appName?: string;
  workflowType?: string;
  mode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
}): void {
  sdkEventEngine.ingest({
    kind: "spectyra.sdk.v1",
    phase: "session_start",
    sessionId: input.sessionId,
    runId: input.runId,
    appName: input.appName,
    workflowType: input.workflowType,
    report: minimalReportForSessionStart(
      input.runId,
      input.mode,
      input.telemetryMode,
      input.promptSnapshotMode,
    ),
  });
}

export function ingestSdkSessionEnd(input: {
  sessionId: string;
  runId: string;
  appName?: string;
  workflowType?: string;
}): void {
  sdkEventEngine.ingest({
    kind: "spectyra.sdk.v1",
    phase: "session_end",
    sessionId: input.sessionId,
    runId: input.runId,
    appName: input.appName,
    workflowType: input.workflowType,
  });
}

export function ingestSdkComplete(input: {
  sessionId: string;
  runId: string;
  stepId?: string;
  appName?: string;
  workflowType?: string;
  report: SavingsReport;
}): void {
  sdkEventEngine.ingest({
    kind: "spectyra.sdk.v1",
    phase: "complete",
    sessionId: input.sessionId,
    runId: input.runId,
    stepId: input.stepId,
    appName: input.appName,
    workflowType: input.workflowType,
    report: input.report,
  });
}

/**
 * After a standalone `spectyra.complete()` (no `startSpectyraSession`), emit one step’s worth
 * of normalized events. Uses `runContext.sessionId` when set, otherwise `runId` as the session key.
 */
export function emitSdkEventsForStandaloneComplete(
  telemetryMode: TelemetryMode | undefined,
  input: SpectyraCompleteInput,
  result: SpectyraCompleteResult<unknown>,
): void {
  if (input.runContext?.emitNormalizedEvents === false) return;
  if (!shouldEmitSdkNormalizedEvents(telemetryMode ?? "local")) return;
  const sessionId = input.runContext?.sessionId ?? result.report.runId;
  ingestSdkComplete({
    sessionId,
    runId: result.report.runId,
    stepId: `step_${result.report.runId}`,
    appName: input.runContext?.appName,
    workflowType: input.runContext?.workflowType,
    report: result.report,
  });
  if (result.promptComparison) {
    ingestSdkPromptComparisonAvailable({
      sessionId,
      runId: result.report.runId,
      stepId: `step_${result.report.runId}`,
      appName: input.runContext?.appName,
      workflowType: input.runContext?.workflowType,
      comparisonRunId: result.report.runId,
      storageMode: result.promptComparison.storageMode,
    });
  }
}

export function ingestSdkPromptComparisonAvailable(input: {
  sessionId: string;
  runId: string;
  stepId?: string;
  appName?: string;
  workflowType?: string;
  comparisonRunId: string;
  storageMode?: string;
}): void {
  sdkEventEngine.ingest({
    kind: "spectyra.sdk.v1",
    phase: "prompt_comparison_available",
    sessionId: input.sessionId,
    runId: input.runId,
    stepId: input.stepId,
    appName: input.appName,
    workflowType: input.workflowType,
    promptComparisonRef: { runId: input.comparisonRunId, storageMode: input.storageMode },
  });
}
