import type { SpectyraRunMode } from "@spectyra/core-types";
import type { SpectyraCompleteInput, SpectyraCompleteResult, SpectyraMonitorSdkConfig, SpectyraConfig } from "../types.js";
import type {
  SpectyraMonitorEvent,
  SpectyraMonitorIntegrationMode,
  SpectyraMonitorOptimizerStatus,
  SpectyraMonitorPricingSource,
} from "./monitorTypes.js";
import { normalizeMonitorProvider } from "./providerDetection.js";
import { extractUsageFromProviderResult } from "./usageExtraction.js";
import { estimateCost } from "../local/tokenEstimator.js";
import { getPricingSnapshot, getPricingSnapshotMeta } from "../pricing/pricingRuntime.js";
import { buildWasteSignalsFromCompletePath } from "./wasteHeuristics.js";

function charCountMessages(messages: SpectyraCompleteInput["messages"]): number {
  let n = 0;
  for (const m of messages) {
    n += (m.content ?? "").length + m.role.length;
  }
  return n;
}

function toolsEnabled(messages: SpectyraCompleteInput["messages"]): boolean {
  return messages.some((m) => Array.isArray(m.tool_calls) && m.tool_calls.length > 0);
}

function resolveOptimizerStatus(args: {
  passthrough: boolean;
  effectiveMode: SpectyraRunMode;
  licenseLimited: boolean;
}): SpectyraMonitorOptimizerStatus {
  if (args.passthrough) return "disabled_quota";
  if (args.effectiveMode === "off") return "disabled_config";
  if (args.licenseLimited) return "disabled_config";
  return "enabled";
}

function resolvePricingSource(fromUsage: boolean, calculateCosts: boolean): SpectyraMonitorPricingSource {
  if (!calculateCosts) return "unknown";
  if (fromUsage) return "provider_usage";
  return "local_token_estimate";
}

function projectedMissedUsd(
  rep: SpectyraCompleteResult<unknown>["report"],
  out: SpectyraCompleteResult<unknown>,
): number {
  const p = out.projectedSavingsIfActivated;
  if (typeof p !== "number" || p <= 0) return 0;
  const snap = getPricingSnapshot();
  const afterIn = Math.max(0, rep.inputTokensBefore - p);
  const hypo = estimateCost(rep.provider, rep.model, afterIn, rep.outputTokens, snap);
  return Math.max(0, rep.estimatedCostBefore - hypo);
}

export interface BuildMonitorEventFromCompleteArgs {
  config: SpectyraConfig;
  monitor?: SpectyraMonitorSdkConfig;
  input: SpectyraCompleteInput;
  out: SpectyraCompleteResult<unknown>;
  durationMs: number;
  optimized: boolean;
  passthrough: boolean;
  effectiveMode: SpectyraRunMode;
  integrationMode?: SpectyraMonitorIntegrationMode;
}

/**
 * Build a metadata-only monitor row after a successful `complete()` / `run()`.
 * @public
 */
export function buildMonitorEventFromComplete(args: BuildMonitorEventFromCompleteArgs): SpectyraMonitorEvent {
  const { input, out, durationMs, optimized, passthrough, effectiveMode, monitor } = args;
  const rep = out.report;
  const mon = monitor ?? {};
  const calculateCosts = mon.calculateCosts !== false;
  const estimateTokensWhenMissing = mon.estimateTokensWhenMissing !== false;

  const providerEnum = normalizeMonitorProvider(rep.provider);
  const extracted = extractUsageFromProviderResult(rep.provider, out.providerResult);
  const fromUsage = Boolean(extracted?.outputTokens || extracted?.inputTokens);
  const pricingSource = resolvePricingSource(fromUsage, calculateCosts);

  let inputTokens = rep.inputTokensBefore;
  let outputTokens = rep.outputTokens;
  if (estimateTokensWhenMissing && extracted) {
    if (typeof extracted.inputTokens === "number" && extracted.inputTokens > 0) {
      inputTokens = extracted.inputTokens;
    }
    if (typeof extracted.outputTokens === "number" && extracted.outputTokens > 0) {
      outputTokens = extracted.outputTokens;
    }
  }

  const meta = getPricingSnapshotMeta();
  const missedFromDiff = Math.max(0, rep.estimatedCostBefore - rep.estimatedCostAfter);
  const missedFromProjection = !optimized ? projectedMissedUsd(rep, out) : 0;
  const missedSavingsUsd = optimized ? 0 : Math.max(missedFromDiff, missedFromProjection);

  let actualCostUsd: number | undefined;
  let optimizedCostUsd: number | undefined;
  let savedUsd: number | undefined;
  let savingsPct: number | undefined;
  let projectedOptimizedCostUsd: number | undefined;
  let missedSavingsPct: number | undefined;

  if (calculateCosts) {
    actualCostUsd = rep.estimatedCostAfter;
    optimizedCostUsd = rep.estimatedCostAfter;
    savedUsd = optimized ? rep.estimatedSavings : 0;
    savingsPct = optimized ? rep.estimatedSavingsPct : undefined;
    if (!optimized && missedSavingsUsd > 0 && rep.estimatedCostBefore > 0) {
      projectedOptimizedCostUsd = Math.max(0, rep.estimatedCostBefore - missedSavingsUsd);
      missedSavingsPct = (missedSavingsUsd / rep.estimatedCostBefore) * 100;
    }
  }

  const missedSavingsConfidence = missedSavingsUsd > 0 ? ("medium" as const) : undefined;
  const missedSavingsSource =
    missedSavingsUsd <= 0
      ? undefined
      : missedFromProjection > missedFromDiff
        ? ("local_simulation" as const)
        : ("default_baseline" as const);

  const optimizerStatus: SpectyraMonitorOptimizerStatus = optimized
    ? "enabled"
    : resolveOptimizerStatus({
        passthrough,
        effectiveMode,
        licenseLimited: Boolean(out.licenseLimited),
      });

  const wasteSignals = buildWasteSignalsFromCompletePath({
    inputTokens,
    outputTokens,
    promptLengthChars: charCountMessages(input.messages),
    messageCount: input.messages.length,
    toolsEnabled: toolsEnabled(input.messages),
    model: rep.model,
    latencyMs: durationMs,
    actualCostUsd: calculateCosts ? rep.estimatedCostAfter : undefined,
    missedSavingsUsd: calculateCosts ? missedSavingsUsd : undefined,
  });

  return {
    eventId: rep.runId,
    timestamp: rep.createdAt ?? new Date().toISOString(),
    project: input.runContext?.project ?? args.config.projectId,
    environment: input.runContext?.environment ?? (typeof args.config.environment === "string" ? args.config.environment : undefined),
    service: input.runContext?.service ?? args.config.service,
    endpoint: input.runContext?.appName,
    operationName: input.runContext?.workflowType,
    workflowType: input.runContext?.workflowType,
    traceId: input.runContext?.traceId,
    sessionId: input.runContext?.sessionId,
    runId: rep.runId,

    provider: providerEnum,
    model: rep.model,
    integrationMode: args.integrationMode ?? "explicit_sdk",
    sdkLanguage: "typescript",

    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,

    actualCostUsd,
    optimizedCostUsd,
    savedUsd,
    savingsPct,
    projectedOptimizedCostUsd,
    missedSavingsUsd,
    missedSavingsPct,
    missedSavingsConfidence,
    missedSavingsSource,

    optimizerEnabled: effectiveMode === "on" && !passthrough,
    optimizerApplied: optimized,
    optimizerStatus,

    latencyMs: durationMs,
    spectyraOverheadMs: durationMs,

    success: rep.success !== false,

    promptLengthChars: charCountMessages(input.messages),
    messageCount: input.messages.length,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    toolsEnabled: toolsEnabled(input.messages),

    pricingSource,
    pricingVersion: meta.version,
    pricingStale: meta.stale,

    wasteSignals: wasteSignals.length ? wasteSignals : undefined,

    metadataOnly: true,
  };
}

export interface BuildFailureMonitorEventArgs {
  config: SpectyraConfig;
  input: SpectyraCompleteInput;
  durationMs: number;
  error: unknown;
  runId: string;
}

/**
 * Build a monitor row when `complete()` throws before returning a result.
 * @public
 */
export function buildFailureMonitorEvent(args: BuildFailureMonitorEventArgs): SpectyraMonitorEvent {
  const err = args.error;
  const name = err instanceof Error ? err.name : "Error";
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : undefined;
  const providerEnum = normalizeMonitorProvider(args.input.provider);

  return {
    eventId: args.runId,
    timestamp: new Date().toISOString(),
    project: args.input.runContext?.project ?? args.config.projectId,
    environment:
      args.input.runContext?.environment ??
      (typeof args.config.environment === "string" ? args.config.environment : undefined),
    service: args.input.runContext?.service ?? args.config.service,
    traceId: args.input.runContext?.traceId,
    sessionId: args.input.runContext?.sessionId,
    runId: args.runId,

    provider: providerEnum,
    model: args.input.model,
    integrationMode: "explicit_sdk",
    sdkLanguage: "typescript",

    latencyMs: args.durationMs,
    success: false,
    errorType: name,
    errorCode: code,

    pricingSource: "unknown",
    metadataOnly: true,
  };
}
