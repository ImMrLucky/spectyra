/**
 * Remote Chat Client
 * 
 * Handles chat optimization API calls (backwards compatibility)
 */

import type { ChatOptions, ChatResponse } from "../types.js";
import { postJson } from "./http.js";

export interface ChatRemoteConfig {
  endpoint: string;
  apiKey: string;
  provider: string;
  providerKey: string;
}

/**
 * Send chat request to Spectyra API for optimization
 */
export async function chatRemote(
  config: ChatRemoteConfig,
  options: ChatOptions
): Promise<ChatResponse> {
  const url = `${config.endpoint}/chat`;
  
  const body = {
    path: options.path,
    provider: config.provider,
    model: options.model,
    messages: options.messages,
    mode: "optimized" as const,
    optimization_level: options.optimization_level ?? 2,
    conversation_id: options.conversation_id,
    dry_run: options.dry_run ?? false,
  };
  
  // Make request with both Spectyra key and provider key (BYOK)
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SPECTYRA-API-KEY": config.apiKey,
      "X-PROVIDER-KEY": config.providerKey, // BYOK - never stored server-side
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Spectyra API error: ${error.error || response.statusText}`);
  }
  
  return response.json() as Promise<ChatResponse>;
}
