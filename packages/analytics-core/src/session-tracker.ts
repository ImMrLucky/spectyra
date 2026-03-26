/**
 * Session tracker — groups steps, emits real-time analytics events.
 */

import type { SavingsReport } from "@spectyra/core-types";
import type { TelemetryMode, PromptSnapshotMode, SpectyraRunMode } from "@spectyra/core-types";
import type {
  AnalyticsEvent,
  SessionAnalyticsRecord,
  SpectyraAnalyticsIntegration,
  StepAnalyticsRecord,
} from "./types.js";
import { aggregateStepsToSession } from "./aggregators.js";
import { stepFromSavingsReport } from "./calculators.js";

export type SessionTrackerOptions = {
  sessionId?: string;
  runId?: string;
  mode: SpectyraRunMode;
  integrationType: SpectyraAnalyticsIntegration;
  appName?: string;
  workflowType?: string;
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  onEvent?: (e: AnalyticsEvent) => void;
};

function randomId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export class SpectyraSessionTracker {
  readonly sessionId: string;
  readonly runId: string;
  private readonly opts: SessionTrackerOptions;
  private steps: StepAnalyticsRecord[] = [];
  private stepCounter = 0;
  private startedAt: string;

  constructor(opts: SessionTrackerOptions) {
    this.opts = opts;
    this.sessionId = opts.sessionId ?? randomId();
    this.runId = opts.runId ?? this.sessionId;
    this.startedAt = new Date().toISOString();
    this.emit({
      type: "session_started",
      session: this.snapshotPartial(),
    });
  }

  private snapshotPartial(): SessionAnalyticsRecord {
    return aggregateStepsToSession(this.steps, {
      sessionId: this.sessionId,
      runId: this.runId,
      startedAt: this.startedAt,
      mode: this.opts.mode,
      integrationType: this.opts.integrationType,
      appName: this.opts.appName,
      workflowType: this.opts.workflowType,
      telemetryMode: this.opts.telemetryMode,
      promptSnapshotMode: this.opts.promptSnapshotMode,
    });
  }

  /** Live aggregate of steps so far (same shape as finish, without ending the session). */
  getCurrentSession(): SessionAnalyticsRecord {
    return this.snapshotPartial();
  }

  private emit(e: AnalyticsEvent): void {
    this.opts.onEvent?.(e);
  }

  /**
   * Record one completed optimization step from a SavingsReport.
   */
  recordStepFromReport(
    report: SavingsReport,
    extra?: { repeatedContextTokensAvoided?: number; repeatedToolOutputTokensAvoided?: number },
  ): StepAnalyticsRecord {
    const stepId = `${this.sessionId}_step_${this.stepCounter++}`;
    const step = stepFromSavingsReport(
      report,
      { sessionId: this.sessionId, runId: this.runId, stepId },
      {
        stepIndex: this.steps.length,
        integrationType: this.opts.integrationType,
        appName: this.opts.appName,
        workflowType: this.opts.workflowType,
        repeatedContextTokensAvoided: extra?.repeatedContextTokensAvoided,
        repeatedToolOutputTokensAvoided: extra?.repeatedToolOutputTokensAvoided,
      },
    );
    this.steps.push(step);
    this.emit({ type: "step_completed", step });
    const session = this.snapshotPartial();
    this.emit({ type: "session_updated", session });
    return step;
  }

  /** Append a pre-built step (e.g. from companion instrumentation). */
  addStep(step: StepAnalyticsRecord): void {
    this.steps.push(step);
    this.emit({ type: "step_completed", step });
    this.emit({ type: "session_updated", session: this.snapshotPartial() });
  }

  getSteps(): StepAnalyticsRecord[] {
    return [...this.steps];
  }

  /** Finalize workflow session. */
  finish(): SessionAnalyticsRecord {
    const endedAt = new Date().toISOString();
    const session = aggregateStepsToSession(this.steps, {
      sessionId: this.sessionId,
      runId: this.runId,
      startedAt: this.startedAt,
      endedAt,
      mode: this.opts.mode,
      integrationType: this.opts.integrationType,
      appName: this.opts.appName,
      workflowType: this.opts.workflowType,
      telemetryMode: this.opts.telemetryMode,
      promptSnapshotMode: this.opts.promptSnapshotMode,
    });
    this.emit({ type: "session_finished", session });
    return session;
  }
}

export function createSessionTracker(opts: SessionTrackerOptions): SpectyraSessionTracker {
  return new SpectyraSessionTracker(opts);
}
