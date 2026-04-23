/**
 * Tool-agnostic aggregation: uses only SpectyraEvent.type and generic payload keys.
 */

import { type SpectyraRunMode, type TelemetryMode, type PromptSnapshotMode, normalizeSpectyraRunMode } from "@spectyra/core-types";
import type {
  SessionAnalyticsRecord,
  StepAnalyticsRecord,
  SpectyraAnalyticsIntegration,
} from "@spectyra/analytics-core";
import { aggregateStepsToSession, stepFromSavingsReport } from "@spectyra/analytics-core";
import type { SavingsReport } from "@spectyra/core-types";
import type { SpectyraEvent, SpectyraEventIntegrationType } from "./types.js";
import type { LiveSessionState } from "./live-state.js";

function readNum(p: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

function mapIntegration(t: SpectyraEventIntegrationType): SpectyraAnalyticsIntegration {
  const allowed = new Set<SpectyraAnalyticsIntegration>([
    "sdk-wrapper",
    "local-companion",
    "observe-preview",
    "openclaw-jsonl",
    "claude-hooks",
    "claude-jsonl",
    "openai-tracing",
    "generic-jsonl",
    "unknown",
  ]);
  return (allowed.has(t as SpectyraAnalyticsIntegration) ? t : "unknown") as SpectyraAnalyticsIntegration;
}

type StepAcc = {
  stepId: string;
  inputBefore: number;
  inputAfter: number;
  outputTokens: number;
  transforms: string[];
  latencyMs?: number;
  success?: boolean;
};

export class EventSessionAggregator {
  private sessionId = "";
  private runId = "";
  private startedAt = new Date().toISOString();
  private mode: SpectyraRunMode = "on";
  private telemetryMode: TelemetryMode = "local";
  private promptSnapshotMode: PromptSnapshotMode = "local_only";
  private appName?: string;
  private workflowType?: string;
  private provider?: string;
  private model?: string;
  private integration: SpectyraAnalyticsIntegration = "unknown";

  private steps: StepAcc[] = [];
  private stepIndex = 0;
  private current: StepAcc | null = null;
  private promptComparisonAvailable = false;
  private syncState: LiveSessionState["syncState"] = "not_synced";

  reset() {
    this.sessionId = "";
    this.runId = "";
    this.startedAt = new Date().toISOString();
    this.steps = [];
    this.stepIndex = 0;
    this.current = null;
    this.promptComparisonAvailable = false;
  }

  push(event: SpectyraEvent): void {
    // Chat flows often emit optimization/provider events without a prior session_started; still bind ids.
    if (event.sessionId?.trim() && !this.sessionId) this.sessionId = event.sessionId.trim();
    if (event.runId?.trim() && !this.runId) this.runId = event.runId.trim();

    this.telemetryMode = event.security.telemetryMode;
    this.promptSnapshotMode = event.security.promptSnapshotMode;
    this.integration = mapIntegration(event.source.integrationType);
    if (event.appName) this.appName = event.appName;
    if (event.workflowType) this.workflowType = event.workflowType;
    if (event.provider) this.provider = event.provider;
    if (event.model) this.model = event.model;

    const p = event.payload;

    switch (event.type) {
      case "session_started": {
        this.sessionId = event.sessionId;
        this.runId = event.runId;
        this.startedAt = event.timestamp;
        const modeStr =
          typeof p["runMode"] === "string"
            ? p["runMode"]
            : typeof p["mode"] === "string"
              ? p["mode"]
              : undefined;
        if (modeStr) this.mode = normalizeSpectyraRunMode(modeStr, "on");
        break;
      }
      case "step_started": {
        const sid = event.stepId ?? `step_${this.stepIndex++}`;
        this.current = {
          stepId: sid,
          inputBefore: readNum(p, "estimatedInputTokens", "inputTokensBefore") ?? 0,
          inputAfter: readNum(p, "estimatedInputTokensAfter", "inputTokensAfter") ?? 0,
          outputTokens: 0,
          transforms: [],
        };
        break;
      }
      case "optimization_simulated": {
        if (!this.current) {
          const sid = event.stepId ?? `step_${this.stepIndex++}`;
          this.current = { stepId: sid, inputBefore: 0, inputAfter: 0, outputTokens: 0, transforms: [] };
        }
        this.current.inputBefore = readNum(p, "inputTokensBefore", "estimatedTokensBefore") ?? this.current.inputBefore;
        this.current.inputAfter = readNum(p, "inputTokensAfter", "estimatedTokensAfter") ?? this.current.inputAfter;
        break;
      }
      case "optimization_applied": {
        if (!this.current) {
          const sid = event.stepId ?? `step_${this.stepIndex++}`;
          this.current = { stepId: sid, inputBefore: 0, inputAfter: 0, outputTokens: 0, transforms: [] };
        }
        this.current.inputBefore = readNum(p, "inputTokensBefore") ?? this.current.inputBefore;
        this.current.inputAfter = readNum(p, "inputTokensAfter") ?? this.current.inputAfter;
        const tr = p["transformsApplied"];
        if (Array.isArray(tr)) this.current.transforms = tr.filter((x) => typeof x === "string") as string[];
        break;
      }
      case "provider_request_completed": {
        if (!this.current) {
          const sid = event.stepId ?? `step_${this.stepIndex++}`;
          this.current = { stepId: sid, inputBefore: 0, inputAfter: 0, outputTokens: 0, transforms: [] };
        }
        this.current.outputTokens = readNum(p, "outputTokens", "completionTokens") ?? this.current.outputTokens;
        const inTok = readNum(p, "inputTokens", "promptTokens");
        if (inTok != null) {
          this.current.inputAfter = inTok;
        }
        this.current.latencyMs = readNum(p, "latencyMs", "latency_ms");
        this.current.success = p["success"] !== false;
        this.finalizeCurrentStep();
        break;
      }
      case "step_completed":
        this.finalizeCurrentStep();
        break;
      case "prompt_comparison_available":
        this.promptComparisonAvailable = true;
        break;
      case "session_finished":
        this.finalizeCurrentStep();
        break;
      case "sync_state_changed": {
        const s = p["syncState"];
        if (s === "not_synced" || s === "queued" || s === "synced" || s === "sync_failed") {
          this.syncState = s;
        }
        break;
      }
      default:
        break;
    }
  }

  private finalizeCurrentStep() {
    if (!this.current) return;
    const c = this.current;
    if (c.inputBefore === 0 && c.inputAfter === 0 && c.outputTokens === 0 && c.transforms.length === 0) {
      this.current = null;
      return;
    }
    this.steps.push({ ...c });
    this.current = null;
  }

  private stepsToRecords(): StepAnalyticsRecord[] {
    return this.steps.map((s, i) => {
      const report: SavingsReport = {
        runId: this.runId || "run",
        mode: this.mode,
        integrationType: this.integration,
        provider: this.provider ?? "unknown",
        model: this.model ?? "unknown",
        inputTokensBefore: s.inputBefore,
        inputTokensAfter: s.inputAfter,
        outputTokens: s.outputTokens,
        estimatedCostBefore: 0,
        estimatedCostAfter: 0,
        estimatedSavings: 0,
        estimatedSavingsPct: 0,
        telemetryMode: this.telemetryMode,
        promptSnapshotMode: this.promptSnapshotMode,
        inferencePath: "direct_provider",
        providerBillingOwner: "customer",
        transformsApplied: s.transforms,
        success: s.success ?? true,
        createdAt: this.startedAt,
      };
      return stepFromSavingsReport(
        report,
        {
          sessionId: this.sessionId || "session",
          runId: this.runId || "run",
          stepId: s.stepId,
        },
        {
          stepIndex: i,
          integrationType: this.integration,
          appName: this.appName,
          workflowType: this.workflowType,
        },
      );
    });
  }

  getLiveState(): LiveSessionState {
    const completed = this.stepsToRecords();
    let preview: StepAnalyticsRecord | null = null;
    if (this.current) {
      const r: SavingsReport = {
        runId: this.runId,
        mode: this.mode,
        integrationType: this.integration,
        provider: this.provider ?? "unknown",
        model: this.model ?? "unknown",
        inputTokensBefore: this.current.inputBefore,
        inputTokensAfter: this.current.inputAfter,
        outputTokens: this.current.outputTokens,
        estimatedCostBefore: 0,
        estimatedCostAfter: 0,
        estimatedSavings: 0,
        estimatedSavingsPct: 0,
        telemetryMode: this.telemetryMode,
        promptSnapshotMode: this.promptSnapshotMode,
        inferencePath: "direct_provider",
        providerBillingOwner: "customer",
        transformsApplied: this.current.transforms,
        createdAt: new Date().toISOString(),
      };
      preview = stepFromSavingsReport(
        r,
        {
          sessionId: this.sessionId || "session",
          runId: this.runId || "run",
          stepId: `${this.current.stepId}_partial`,
        },
        {
          stepIndex: completed.length,
          integrationType: this.integration,
          appName: this.appName,
          workflowType: this.workflowType,
        },
      );
    }

    const all = preview ? [...completed, preview] : completed;
    const session: SessionAnalyticsRecord | null =
      all.length > 0
        ? aggregateStepsToSession(all, {
            sessionId: this.sessionId || "session",
            runId: this.runId || "run",
            startedAt: this.startedAt,
            mode: this.mode,
            integrationType: this.integration,
            appName: this.appName,
            workflowType: this.workflowType,
            telemetryMode: this.telemetryMode,
            promptSnapshotMode: this.promptSnapshotMode,
          })
        : null;

    return {
      session,
      currentStep: preview ?? completed[completed.length - 1] ?? null,
      recentSteps: completed.slice(-20),
      promptComparisonAvailable: this.promptComparisonAvailable,
      syncState: this.syncState,
    };
  }
}
