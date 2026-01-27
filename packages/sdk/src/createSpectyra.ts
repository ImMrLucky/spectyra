/**
 * Create Spectyra SDK Instance
 * 
 * Main entry point for SDK-first agentic integration
 */

import type {
  SpectyraConfig,
  SpectyraCtx,
  PromptMeta,
  ClaudeAgentOptions,
  AgentOptionsResponse,
  ChatOptions,
  ChatResponse,
} from "./types.js";
import { decideAgent } from "./local/decideAgent.js";
import { toClaudeAgentOptions } from "./adapters/claudeAgent.js";
import { fetchAgentOptions, sendAgentEvent } from "./remote/agentRemote.js";
import { chatRemote, type ChatRemoteConfig } from "./remote/chatRemote.js";

export interface SpectyraInstance {
  /**
   * Get agent options locally (SDK mode - default)
   * Synchronous, works offline, no API calls
   */
  agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions;
  
  /**
   * Get agent options from remote API (API mode)
   * Asynchronous, requires endpoint and apiKey
   */
  agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse>;
  
  /**
   * Send agent event to remote API
   */
  sendAgentEvent(ctx: SpectyraCtx, event: any): Promise<void>;
  
  /**
   * Observe agent stream and forward events
   */
  observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<any>): Promise<void>;
  
  /**
   * Chat optimization (remote API mode)
   * Optional wrapper for /v1/chat endpoint
   */
  chatRemote?(options: ChatOptions): Promise<ChatResponse>;
}

/**
 * Create a Spectyra SDK instance
 * 
 * @example
 * ```ts
 * // Local mode (default, no API required)
 * const spectyra = createSpectyra({ mode: "local" });
 * const options = spectyra.agentOptions(ctx, prompt);
 * 
 * // API mode (enterprise control plane)
 * const spectyra = createSpectyra({
 *   mode: "api",
 *   endpoint: "https://spectyra.up.railway.app/v1",
 *   apiKey: process.env.SPECTYRA_API_KEY,
 * });
 * const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
 * ```
 */
export function createSpectyra(config: SpectyraConfig = {}): SpectyraInstance {
  const mode = config.mode || "local";
  const endpoint = config.endpoint;
  const apiKey = config.apiKey;
  
  // Validate API mode requirements
  if (mode === "api") {
    if (!endpoint) {
      throw new Error("endpoint is required for API mode");
    }
    if (!apiKey) {
      throw new Error("apiKey is required for API mode");
    }
  }
  
  return {
    /**
     * Local agent options (synchronous, offline)
     */
    agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions {
      const decision = decideAgent({ config, ctx, prompt });
      return toClaudeAgentOptions(decision);
    },
    
    /**
     * Remote agent options (asynchronous, requires API)
     */
    async agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse> {
      if (mode !== "api" || !endpoint || !apiKey) {
        throw new Error("agentOptionsRemote requires API mode with endpoint and apiKey");
      }
      
      const response = await fetchAgentOptions(endpoint, apiKey, ctx, promptMeta);
      
      // Update ctx with run_id if returned
      if (response.run_id && !ctx.runId) {
        ctx.runId = response.run_id;
      }
      
      return response;
    },
    
    /**
     * Send agent event
     */
    async sendAgentEvent(ctx: SpectyraCtx, event: any): Promise<void> {
      if (mode !== "api" || !endpoint || !apiKey) {
        // In local mode, events are no-ops (best effort)
        return;
      }
      
      try {
        await sendAgentEvent(endpoint, apiKey, ctx, event);
      } catch (error) {
        // Best-effort: don't throw, just log if possible
        console.warn("Failed to send agent event:", error);
      }
    },
    
    /**
     * Observe agent stream and forward events
     */
    async observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<any>): Promise<void> {
      try {
        for await (const event of stream) {
          await this.sendAgentEvent(ctx, event);
        }
      } catch (error) {
        // Best-effort: don't throw
        console.warn("Error observing agent stream:", error);
      }
    },
    
    /**
     * Chat remote (optional, for backwards compatibility)
     */
    chatRemote: mode === "api" && endpoint && apiKey
      ? async (options: ChatOptions): Promise<ChatResponse> => {
          // This requires provider and providerKey which aren't in config
          // So this is only available if user provides them separately
          throw new Error("chatRemote requires provider and providerKey. Use legacy SpectyraClient for chat optimization.");
        }
      : undefined,
  };
}
