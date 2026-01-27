/**
 * Legacy Spectyra Client
 * 
 * @deprecated Use createSpectyra({mode:"api"}).chatRemote(...) or createSpectyra({mode:"local"})
 * 
 * This class is maintained for backwards compatibility.
 * It now uses the new remote chat client internally.
 */

import type {
  SpectyraClientConfig,
  ChatOptions,
  ChatResponse,
} from "../types.js";
import { chatRemote, type ChatRemoteConfig } from "../remote/chatRemote.js";

/**
 * @deprecated Use createSpectyra({mode:"api"}) instead
 * 
 * Legacy client for chat optimization via API.
 * For agentic use cases, use createSpectyra() with agentOptions().
 */
export class SpectyraClient {
  private config: SpectyraClientConfig;

  constructor(config: SpectyraClientConfig) {
    this.config = config;
    
    if (!config.apiUrl) {
      throw new Error("apiUrl is required");
    }
    if (!config.spectyraKey) {
      throw new Error("spectyraKey is required");
    }
    if (!config.provider) {
      throw new Error("provider is required");
    }
    if (!config.providerKey) {
      throw new Error("providerKey is required (BYOK)");
    }
  }

  /**
   * Send a chat request through Spectyra optimization.
   * 
   * @deprecated Use createSpectyra({mode:"api"}).chatRemote() instead
   * 
   * @param options Chat options
   * @returns Optimized response with savings metrics
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const {
      model,
      messages,
      path,
      optimization_level = 2,
      conversation_id,
      dry_run = false,
    } = options;

    // Validate messages
    if (!messages || messages.length === 0) {
      throw new Error("messages array cannot be empty");
    }

    // Use new remote chat client
    return chatRemote(
      {
        endpoint: this.config.apiUrl,
        apiKey: this.config.spectyraKey,
        provider: this.config.provider,
        providerKey: this.config.providerKey,
      },
      {
        model,
        messages,
        path,
        optimization_level,
        conversation_id,
        dry_run,
      }
    );
  }

  /**
   * Estimate savings for a conversation without making real LLM calls.
   * 
   * @deprecated Use createSpectyra({mode:"api"}).chatRemote() with dry_run option
   * 
   * @param options Chat options (dry_run will be set to true)
   * @returns Estimated savings
   */
  async estimateSavings(options: Omit<ChatOptions, "dry_run">): Promise<ChatResponse> {
    return this.chat({
      ...options,
      dry_run: true,
    });
  }

  /**
   * Get the current configuration (without sensitive keys)
   */
  getConfig(): Omit<SpectyraClientConfig, "spectyraKey" | "providerKey"> {
    return {
      apiUrl: this.config.apiUrl,
      provider: this.config.provider,
    };
  }
}
