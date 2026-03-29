/**
 * Create Spectyra SDK Instance
 *
 * Main entry point for the Spectyra SDK.
 *
 * Primary path: local-first, direct-provider optimization via complete().
 * Legacy path: remote agent options and chat API (deprecated).
 */

import type {
  SpectyraConfig,
  SpectyraCtx,
  PromptMeta,
  ClaudeAgentOptions,
  AgentOptionsResponse,
  ChatOptions,
  ChatResponse,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
} from "./types.js";
import { decideAgent } from "./local/decideAgent.js";
import { toClaudeAgentOptions } from "./adapters/claudeAgent.js";
import { fetchAgentOptions, sendAgentEvent } from "./remote/agentRemote.js";
import { localComplete } from "./local/localWrapper.js";

export interface SpectyraInstance {
  /**
   * Primary API — wrap a provider call with Spectyra optimization.
   *
   * The provider call goes directly from your process to the provider
   * using your own SDK client. Spectyra optimizes locally before the call
   * (in `on` mode) or computes projected savings without mutation (in `observe` mode).
   *
   * @example
   * ```ts
   * const { providerResult, report } = await spectyra.complete({
   *   provider: "openai",
   *   client: openaiClient,
   *   model: "gpt-4.1-mini",
   *   messages,
   * });
   * ```
   */
  complete<TClient, TResult>(
    input: SpectyraCompleteInput<TClient>,
    adapter: ProviderAdapter<TClient, TResult>,
  ): Promise<SpectyraCompleteResult<TResult>>;

  /**
   * Get agent options locally (SDK mode - default)
   * Synchronous, works offline, no API calls
   */
  agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions;

  /**
   * @deprecated Use complete() instead
   * Get agent options from remote API (API mode)
   */
  agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse>;

  /**
   * @deprecated Legacy remote event forwarding
   */
  sendAgentEvent(ctx: SpectyraCtx, event: unknown): Promise<void>;

  /**
   * @deprecated Legacy remote stream observation
   */
  observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<unknown>): Promise<void>;
}

/**
 * Create a Spectyra SDK instance.
 *
 * @example
 * ```ts
 * // Recommended: local-first, direct-provider
 * const spectyra = createSpectyra({
 *   runMode: "on",
 *   telemetry: { mode: "local" },
 *   promptSnapshots: "local_only",
 *   licenseKey: process.env.SPECTYRA_LICENSE_KEY,
 * });
 *
 * const { providerResult, report } = await spectyra.complete(
 *   { provider: "openai", client: openaiClient, model: "gpt-4.1-mini", messages },
 *   createOpenAIAdapter(),
 * );
 * ```
 *
 * @example
 * ```ts
 * // Legacy: local agent options (still works)
 * const spectyra = createSpectyra();
 * const options = spectyra.agentOptions(ctx, prompt);
 * ```
 */
export function createSpectyra(config: SpectyraConfig = {}): SpectyraInstance {
  // Resolve legacy "mode" field to new "runMode"
  const legacyMode = config.mode;
  const endpoint = config.endpoint;
  const apiKey = config.apiKey;

  if (legacyMode === "api") {
    if (!endpoint) throw new Error("endpoint is required for API mode");
    if (!apiKey) throw new Error("apiKey is required for API mode");
  }

  return {
    async complete<TClient, TResult>(
      input: SpectyraCompleteInput<TClient>,
      adapter: ProviderAdapter<TClient, TResult>,
    ): Promise<SpectyraCompleteResult<TResult>> {
      return localComplete(config, input, adapter);
    },

    agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions {
      const decision = decideAgent({ config, ctx, prompt });
      return toClaudeAgentOptions(decision);
    },

    async agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse> {
      if (legacyMode !== "api" || !endpoint || !apiKey) {
        throw new Error("agentOptionsRemote requires API mode with endpoint and apiKey");
      }
      const response = await fetchAgentOptions(endpoint, apiKey, ctx, promptMeta);
      if (response.run_id && !ctx.runId) {
        ctx.runId = response.run_id;
      }
      return response;
    },

    async sendAgentEvent(ctx: SpectyraCtx, event: unknown): Promise<void> {
      if (legacyMode !== "api" || !endpoint || !apiKey) return;
      try {
        await sendAgentEvent(endpoint, apiKey, ctx, event);
      } catch (error) {
        console.warn("Failed to send agent event:", error);
      }
    },

    async observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<unknown>): Promise<void> {
      try {
        for await (const event of stream) {
          await this.sendAgentEvent(ctx, event);
        }
      } catch (error) {
        console.warn("Error observing agent stream:", error);
      }
    },
  };
}
