import type { SpectyraMonitorProvider } from "../monitorTypes.js";
import type { SpectyraFrameworkMonitorRecord } from "./types.js";

export interface SpectyraLangChainHookContext {
  provider: SpectyraMonitorProvider;
  model?: string;
  endpoint?: string;
  workflowType?: string;
  agentName?: string;
  project?: string;
  environment?: string;
  service?: string;
}

function pickUsage(output: Record<string, unknown>): { input: number; output: number } {
  const llmOut = (output.llmOutput ?? output) as Record<string, unknown>;
  const tu = llmOut.tokenUsage as Record<string, unknown> | undefined;
  const u = (output.usage_metadata ?? llmOut.usage ?? tu) as Record<string, unknown> | undefined;
  if (!u) return { input: 0, output: 0 };
  const input = Number(
    u.input_tokens ?? u.promptTokens ?? u.prompt_tokens ?? u.inputTokens ?? u.input_token_count ?? 0,
  );
  const outputT = Number(
    u.output_tokens ?? u.completionTokens ?? u.completion_tokens ?? u.outputTokens ?? u.output_token_count ?? 0,
  );
  return {
    input: Number.isFinite(input) ? input : 0,
    output: Number.isFinite(outputT) ? outputT : 0,
  };
}

/**
 * Plain handler object compatible with LangChain `CallbackManager.fromHandlers([...])`.
 * Does not import `@langchain/core` — pass as a handler bag.
 */
export function createSpectyraLangChainMonitorCallbacks(
  record: SpectyraFrameworkMonitorRecord,
  ctx: SpectyraLangChainHookContext,
): {
  name: string;
  handleLLMStart?: (_llm: unknown, _prompts: unknown, runId: string) => void | Promise<void>;
  handleLLMEnd?: (output: unknown, runId: string) => void | Promise<void>;
  handleLLMError?: (err: unknown, runId: string) => void | Promise<void>;
} {
  const starts = new Map<string, number>();

  return {
    name: "spectyra_monitor",

    handleLLMStart(_llm: unknown, _prompts: unknown, runId: string) {
      starts.set(runId, Date.now());
    },

    handleLLMEnd(output: unknown, runId: string) {
      try {
        const o = output as Record<string, unknown>;
        const { input, output: outTok } = pickUsage(o);
        const t0 = starts.get(runId) ?? Date.now();
        starts.delete(runId);
        record({
          provider: ctx.provider,
          model: ctx.model,
          latencyMs: Math.max(0, Math.round(Date.now() - t0)),
          success: true,
          integrationMode: "framework_hook",
          inputTokens: input,
          outputTokens: outTok,
          totalTokens: input + outTok,
          endpoint: ctx.endpoint,
          workflowType: ctx.workflowType,
          agentName: ctx.agentName,
          project: ctx.project,
          environment: ctx.environment,
          service: ctx.service,
          pricingSource: input || outTok ? "provider_usage" : "unknown",
          optimizerApplied: false,
          optimizerStatus: "not_integrated",
          metadataOnly: true,
        });
      } catch {
        /* fail open */
      }
    },

    handleLLMError(_err: unknown, runId: string) {
      try {
        const t0 = starts.get(runId) ?? Date.now();
        starts.delete(runId);
        record({
          provider: ctx.provider,
          model: ctx.model,
          latencyMs: Math.max(0, Math.round(Date.now() - t0)),
          success: false,
          integrationMode: "framework_hook",
          endpoint: ctx.endpoint,
          workflowType: ctx.workflowType,
          agentName: ctx.agentName,
          project: ctx.project,
          environment: ctx.environment,
          service: ctx.service,
          pricingSource: "unknown",
          optimizerApplied: false,
          optimizerStatus: "not_integrated",
          metadataOnly: true,
        });
      } catch {
        /* fail open */
      }
    },
  };
}
