/**
 * Local direct-provider wrapper.
 *
 * This is the primary SDK path: optimization runs in-process,
 * the provider call goes directly from the customer environment
 * to the provider using the customer's own SDK client.
 *
 * No Spectyra cloud dependency.
 */

import type { ChatMessage } from "../sharedTypes.js";
import type {
  SpectyraConfig,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
} from "../types.js";
import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
} from "@spectyra/core-types";
import { estimateTokens, estimateCost } from "./tokenEstimator.js";

/**
 * Run a provider call wrapped with Spectyra optimization logic.
 *
 * - `off`     → pass-through, no mutation
 * - `observe` → pass-through, compute projected savings
 * - `on`      → optimize messages locally, call provider with optimized messages
 */
export async function localComplete<TClient, TResult>(
  config: SpectyraConfig,
  input: SpectyraCompleteInput<TClient>,
  adapter: ProviderAdapter<TClient, TResult>,
): Promise<SpectyraCompleteResult<TResult>> {
  const runMode: SpectyraRunMode = config.runMode ?? "observe";
  const telemetryMode: TelemetryMode = config.telemetry?.mode ?? "local";
  const promptSnapshotMode: PromptSnapshotMode = config.promptSnapshots ?? "local_only";
  const runId = crypto.randomUUID();

  const originalMessages = input.messages;
  const inputTokensBefore = estimateTokens(originalMessages);

  if (runMode === "off") {
    const { result, text, usage } = await adapter.call({
      client: input.client,
      model: input.model,
      messages: originalMessages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });

    return buildResult({
      runId,
      runMode,
      provider: input.provider,
      model: input.model,
      inputTokensBefore,
      inputTokensAfter: inputTokensBefore,
      outputTokens: usage.outputTokens,
      transformsApplied: [],
      telemetryMode,
      promptSnapshotMode,
      providerResult: result,
    });
  }

  if (runMode === "observe") {
    const { result, text, usage } = await adapter.call({
      client: input.client,
      model: input.model,
      messages: originalMessages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });

    const { optimizedMessages, transforms } = applyLocalOptimizations(originalMessages);
    const inputTokensAfter = estimateTokens(optimizedMessages);

    return buildResult({
      runId,
      runMode,
      provider: input.provider,
      model: input.model,
      inputTokensBefore,
      inputTokensAfter,
      outputTokens: usage.outputTokens,
      transformsApplied: transforms,
      telemetryMode,
      promptSnapshotMode,
      providerResult: result,
      originalMessages,
      optimizedMessages,
    });
  }

  // runMode === "on"
  const { optimizedMessages, transforms } = applyLocalOptimizations(originalMessages);
  const inputTokensAfter = estimateTokens(optimizedMessages);

  const { result, text, usage } = await adapter.call({
    client: input.client,
    model: input.model,
    messages: optimizedMessages,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  return buildResult({
    runId,
    runMode,
    provider: input.provider,
    model: input.model,
    inputTokensBefore,
    inputTokensAfter,
    outputTokens: usage.outputTokens,
    transformsApplied: transforms,
    telemetryMode,
    promptSnapshotMode,
    providerResult: result,
    originalMessages,
    optimizedMessages,
  });
}

// ---------------------------------------------------------------------------
// Lightweight local optimizations (context dedup, trim whitespace, drop stale)
// ---------------------------------------------------------------------------

interface OptimizationResult {
  optimizedMessages: ChatMessage[];
  transforms: string[];
}

function applyLocalOptimizations(messages: ChatMessage[]): OptimizationResult {
  const transforms: string[] = [];
  let optimized = [...messages];

  // 1. Trim excessive whitespace
  optimized = optimized.map((m) => ({
    ...m,
    content: m.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
  }));
  transforms.push("whitespace_normalize");

  // 2. Deduplicate consecutive identical messages
  const deduped: ChatMessage[] = [];
  for (const msg of optimized) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) {
      continue;
    }
    deduped.push(msg);
  }
  if (deduped.length < optimized.length) {
    transforms.push("dedup_consecutive");
  }
  optimized = deduped;

  // 3. Truncate very long tool outputs (keep first/last 500 chars)
  optimized = optimized.map((m) => {
    if (m.role === "tool" && m.content.length > 2000) {
      const head = m.content.slice(0, 500);
      const tail = m.content.slice(-500);
      transforms.push("tool_output_truncate");
      return { ...m, content: `${head}\n...[truncated ${m.content.length - 1000} chars]...\n${tail}` };
    }
    return m;
  });

  // 4. Drop old turns if conversation is very long (keep system + last N turns)
  if (optimized.length > 20) {
    const systemMessages = optimized.filter((m) => m.role === "system");
    const nonSystem = optimized.filter((m) => m.role !== "system");
    const kept = nonSystem.slice(-16);
    optimized = [...systemMessages, ...kept];
    transforms.push("context_window_trim");
  }

  return { optimizedMessages: optimized, transforms };
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

interface BuildResultInput<TResult> {
  runId: string;
  runMode: SpectyraRunMode;
  provider: string;
  model: string;
  inputTokensBefore: number;
  inputTokensAfter: number;
  outputTokens: number;
  transformsApplied: string[];
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  providerResult: TResult;
  originalMessages?: ChatMessage[];
  optimizedMessages?: ChatMessage[];
}

function buildResult<TResult>(input: BuildResultInput<TResult>): SpectyraCompleteResult<TResult> {
  const costBefore = estimateCost(input.provider, input.model, input.inputTokensBefore, input.outputTokens);
  const costAfter = estimateCost(input.provider, input.model, input.inputTokensAfter, input.outputTokens);
  const savings = costBefore - costAfter;
  const savingsPct = costBefore > 0 ? (savings / costBefore) * 100 : 0;
  const tokensSaved = input.inputTokensBefore - input.inputTokensAfter;
  const pctTokensSaved = input.inputTokensBefore > 0
    ? (tokensSaved / input.inputTokensBefore) * 100
    : 0;

  const report: SavingsReport = {
    runId: input.runId,
    mode: input.runMode,
    integrationType: "sdk-wrapper",
    provider: input.provider,
    model: input.model,
    inputTokensBefore: input.inputTokensBefore,
    inputTokensAfter: input.inputTokensAfter,
    outputTokens: input.outputTokens,
    estimatedCostBefore: costBefore,
    estimatedCostAfter: costAfter,
    estimatedSavings: savings,
    estimatedSavingsPct: savingsPct,
    contextReductionPct: pctTokensSaved > 0 ? pctTokensSaved : undefined,
    telemetryMode: input.telemetryMode,
    promptSnapshotMode: input.promptSnapshotMode,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: input.transformsApplied,
    success: true,
    createdAt: new Date().toISOString(),
  };

  let promptComparison: PromptComparison | undefined;
  if (input.originalMessages && input.optimizedMessages && input.promptSnapshotMode !== "none") {
    promptComparison = {
      originalMessagesSummary: summarizeMessages(input.originalMessages),
      optimizedMessagesSummary: summarizeMessages(input.optimizedMessages),
      diffSummary: {
        inputTokensBefore: input.inputTokensBefore,
        inputTokensAfter: input.inputTokensAfter,
        tokensSaved,
        pctSaved: pctTokensSaved,
        transformsApplied: input.transformsApplied,
      },
      storageMode: input.promptSnapshotMode,
      localOnly: input.promptSnapshotMode === "local_only",
    };
  }

  return {
    providerResult: input.providerResult,
    report,
    promptComparison,
    security: {
      inferencePath: "direct_provider",
      providerBillingOwner: "customer",
      telemetryMode: input.telemetryMode,
      promptSnapshotMode: input.promptSnapshotMode,
      cloudRelay: "none",
    },
  };
}

function summarizeMessages(messages: ChatMessage[]): unknown {
  return messages.map((m) => ({
    role: m.role,
    contentLength: m.content.length,
    contentPreview: m.content.slice(0, 100),
  }));
}
