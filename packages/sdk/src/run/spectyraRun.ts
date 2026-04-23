/**
 * Callback-style `run()` API — same local-first pipeline as `complete()`, without requiring a provider SDK client object.
 */

import type { ChatMessage } from "../sharedTypes.js";
import type { SpectyraCompleteInput, SpectyraCompleteResult, ProviderAdapter } from "../types.js";
import type { SpectyraQuotaStatus } from "../observability/observabilityTypes.js";

/** Input for {@link import("../createSpectyra.js").SpectyraInstance.run} (no `client`; executor performs the provider call). */
export interface SpectyraRunInput
  extends Omit<SpectyraCompleteInput<Record<string, never>>, "client"> {
  provider: string;
}

/**
 * Context passed to your executor after Spectyra optimizes messages locally.
 * Prompts never leave the host; the executor calls the provider with your BYOK credentials.
 */
export interface SpectyraRunExecuteContext {
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export type SpectyraRunExecutor<TResult = unknown> = (
  ctx: SpectyraRunExecuteContext,
) => Promise<{
  result: TResult;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}>;

export interface SpectyraRunResult<TResult = unknown> {
  output: TResult;
  usage: { inputTokens: number; outputTokens: number };
  costBefore: number;
  costAfter: number;
  savingsAmount: number;
  savingsPercent: number;
  quotaStatus: SpectyraQuotaStatus;
  /** False when run mode is off, quota forces passthrough, or license limits optimization. */
  optimizationActive: boolean;
  /** Full SDK result for advanced integrations. */
  complete: SpectyraCompleteResult<TResult>;
}

export function createExecutorAdapter<TResult>(
  providerName: string,
  execute: SpectyraRunExecutor<TResult>,
): ProviderAdapter<Record<string, never>, TResult> {
  return {
    providerName,
    async call(args) {
      return execute({
        messages: args.messages,
        model: args.model,
        maxTokens: args.maxTokens,
        temperature: args.temperature,
      });
    },
  };
}

export function mapCompleteToRunResult<TResult>(
  complete: SpectyraCompleteResult<TResult>,
  quotaStatus: SpectyraQuotaStatus,
  optimizationActive: boolean,
): SpectyraRunResult<TResult> {
  const r = complete.report;
  const usage = {
    inputTokens: r.inputTokensAfter,
    outputTokens: r.outputTokens,
  };
  return {
    output: complete.providerResult as TResult,
    usage,
    costBefore: r.estimatedCostBefore,
    costAfter: r.estimatedCostAfter,
    savingsAmount: r.estimatedSavings,
    savingsPercent: r.estimatedSavingsPct,
    quotaStatus,
    optimizationActive,
    complete,
  };
}
