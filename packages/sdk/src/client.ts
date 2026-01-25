/**
 * Spectyra Client - Real-time LLM optimization middleware
 */

import type {
  SpectyraClientConfig,
  ChatOptions,
  ChatResponse,
  ChatMessage,
} from "./types.js";

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

    // Build request
    const url = `${this.config.apiUrl}/chat`;
    const body = {
      path,
      provider: this.config.provider,
      model,
      messages,
      mode: "optimized" as const,
      optimization_level,
      conversation_id,
      dry_run,
    };

    // Make request with Spectyra key and provider key (BYOK)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPECTYRA-KEY": this.config.spectyraKey,
        "X-PROVIDER-KEY": this.config.providerKey, // BYOK - never stored server-side
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Spectyra API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data as ChatResponse;
  }

  /**
   * Estimate savings for a conversation without making real LLM calls.
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
