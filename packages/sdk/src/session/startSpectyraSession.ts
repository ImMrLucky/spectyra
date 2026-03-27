/**
 * Multi-step workflow sessions on top of createSpectyra().
 */

import type { SpectyraInstance } from "../createSpectyra.js";
import type {
  ProviderAdapter,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  SpectyraConfig,
} from "../types.js";
import {
  createSessionTracker,
  type AnalyticsEvent,
  type SessionAnalyticsRecord,
  type SpectyraSessionTracker,
} from "@spectyra/analytics-core";
import {
  ingestSdkComplete,
  ingestSdkPromptComparisonAvailable,
  ingestSdkSessionEnd,
  ingestSdkSessionStart,
  shouldEmitSdkNormalizedEvents,
} from "../events/sdkEvents.js";

export type StartSpectyraSessionOptions = {
  appName?: string;
  workflowType?: string;
  onEvent?: (e: AnalyticsEvent) => void;
};

export type SpectyraSessionHandle = {
  readonly sessionId: string;
  readonly runId: string;
  readonly tracker: SpectyraSessionTracker;
  complete<TClient, TResult>(
    input: SpectyraCompleteInput<TClient>,
    adapter: ProviderAdapter<TClient, TResult>,
  ): Promise<SpectyraCompleteResult<TResult>>;
  /** Aggregate all steps into a final session record (does not block future steps unless you discard the handle). */
  finish(): SessionAnalyticsRecord;
};

/**
 * Start a workflow session — each `complete()` adds a step; call `finish()` for the final report.
 *
 * @example
 * ```ts
 * const spectyra = createSpectyra({ runMode: "on", licenseKey: "..." });
 * const session = startSpectyraSession(spectyra, { runMode: "on" }, { appName: "my-agent" });
 * await session.complete({ provider: "openai", client, model: "gpt-4o-mini", messages }, adapter);
 * const report = session.finish();
 * ```
 */
export function startSpectyraSession(
  spectyra: SpectyraInstance,
  config: SpectyraConfig,
  options: StartSpectyraSessionOptions = {},
): SpectyraSessionHandle {
  const runMode = config.runMode ?? "observe";
  const telemetryMode = config.telemetry?.mode ?? "local";
  const promptSnapshotMode = config.promptSnapshots ?? "local_only";

  const tracker = createSessionTracker({
    mode: runMode,
    integrationType: "sdk-wrapper",
    appName: options.appName,
    workflowType: options.workflowType,
    telemetryMode,
    promptSnapshotMode,
    onEvent: options.onEvent,
  });

  if (shouldEmitSdkNormalizedEvents(telemetryMode)) {
    ingestSdkSessionStart({
      sessionId: tracker.sessionId,
      runId: tracker.runId,
      appName: options.appName,
      workflowType: options.workflowType,
      mode: runMode,
      telemetryMode,
      promptSnapshotMode,
    });
  }

  return {
    sessionId: tracker.sessionId,
    runId: tracker.runId,
    tracker,
    async complete(input, adapter) {
      const result = await spectyra.complete(
        {
          ...input,
          runContext: {
            ...input.runContext,
            emitNormalizedEvents: false,
          },
        },
        adapter,
      );
      const step = tracker.recordStepFromReport(result.report);
      if (shouldEmitSdkNormalizedEvents(telemetryMode)) {
        ingestSdkComplete({
          sessionId: tracker.sessionId,
          runId: result.report.runId,
          stepId: step.stepId,
          appName: options.appName,
          workflowType: options.workflowType,
          report: result.report,
        });
        if (result.promptComparison) {
          ingestSdkPromptComparisonAvailable({
            sessionId: tracker.sessionId,
            runId: result.report.runId,
            stepId: step.stepId,
            appName: options.appName,
            workflowType: options.workflowType,
            comparisonRunId: result.report.runId,
            storageMode: result.promptComparison.storageMode,
          });
        }
      }
      return result;
    },
    finish() {
      const rec = tracker.finish();
      if (shouldEmitSdkNormalizedEvents(telemetryMode)) {
        ingestSdkSessionEnd({
          sessionId: tracker.sessionId,
          runId: tracker.runId,
          appName: options.appName,
          workflowType: options.workflowType,
        });
      }
      return rec;
    },
  };
}
