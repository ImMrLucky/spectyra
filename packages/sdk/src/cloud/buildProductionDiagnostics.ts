import type { FlowSignals } from "@spectyra/canonical-model";
import type { SavingsReport } from "@spectyra/core-types";
import type { SpectyraCompleteInput } from "../types.js";

const MAX_JSON_CHARS = 20_000;

/** Safe, aggregated diagnostics for cloud rollups (no prompt bodies or provider secrets). */
export interface SpectyraProductionDiagnostics {
  provider: string;
  runId: string;
  model?: string;
  integrationType?: string;
  workflowType?: string;
  service?: string;
  traceId?: string;
  sessionId?: string;
  runMode?: string;
  /** Input prompt tokens before optimization (this LLM call). */
  inputTokensBefore?: number;
  /** Input prompt tokens after optimization. */
  inputTokensAfter?: number;
  inputTokensSaved?: number;
  outputTokens?: number;
  messageTurnCount?: number;
  estimatedSavingsPct: number;
  contextReductionPct?: number;
  duplicateReductionPct?: number;
  flowReductionPct?: number;
  repeatedContextTokensAvoided?: number;
  repeatedToolOutputTokensAvoided?: number;
  compressibleUnitsHint?: number;
  transformCount: number;
  transformsAppliedSample?: string[];
  flow?: {
    recommendation: FlowSignals["recommendation"];
    stabilityIndex: number;
    hasContradictions: boolean;
    isStuckLoop: boolean;
    compressibleMessageCount: number;
    detectedPath: FlowSignals["detectedPath"];
  };
}

function safeFlowSlice(flow: FlowSignals): SpectyraProductionDiagnostics["flow"] {
  return {
    recommendation: flow.recommendation,
    stabilityIndex: flow.stabilityIndex,
    hasContradictions: flow.hasContradictions,
    isStuckLoop: flow.isStuckLoop,
    compressibleMessageCount: flow.compressibleMessageCount,
    detectedPath: flow.detectedPath,
  };
}

/**
 * Build a bounded JSON-serializable diagnostics object for `POST /v1/telemetry/run`.
 * Omits free-text flow fields that could echo user content.
 */
export function buildSpectyraProductionDiagnostics(
  report: SavingsReport,
  runContext: SpectyraCompleteInput<unknown>["runContext"] | undefined,
  provider: string,
  flowSignals: FlowSignals | null | undefined,
): SpectyraProductionDiagnostics {
  const transforms = report.transformsApplied ?? [];
  const inputSaved = Math.max(0, report.inputTokensBefore - report.inputTokensAfter);
  const out: SpectyraProductionDiagnostics = {
    provider,
    runId: report.runId,
    model: report.model,
    integrationType: report.integrationType,
    workflowType: runContext?.workflowType,
    service: runContext?.service,
    traceId: runContext?.traceId,
    sessionId: runContext?.sessionId ?? report.sessionId,
    runMode: report.mode,
    inputTokensBefore: report.inputTokensBefore,
    inputTokensAfter: report.inputTokensAfter,
    inputTokensSaved: inputSaved,
    outputTokens: report.outputTokens,
    messageTurnCount: report.messageTurnCount,
    estimatedSavingsPct: report.estimatedSavingsPct,
    contextReductionPct: report.contextReductionPct,
    duplicateReductionPct: report.duplicateReductionPct,
    flowReductionPct: report.flowReductionPct,
    repeatedContextTokensAvoided: report.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: report.repeatedToolOutputTokensAvoided,
    compressibleUnitsHint: report.compressibleUnitsHint,
    transformCount: transforms.length,
    transformsAppliedSample: transforms.length ? transforms.slice(0, 40) : undefined,
    flow: flowSignals ? safeFlowSlice(flowSignals) : undefined,
  };

  const s = JSON.stringify(out);
  if (s.length > MAX_JSON_CHARS) {
    return {
      provider,
      runId: report.runId,
      estimatedSavingsPct: report.estimatedSavingsPct,
      transformCount: transforms.length,
      transformsAppliedSample: transforms.slice(0, 10),
    };
  }
  return out;
}
