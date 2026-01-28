/**
 * Provider-related types
 */

import type { Message, Usage } from "./types";

/**
 * ChatProvider interface for LLM service implementations
 * Used by API services/llm/types.ts
 */
export interface ChatProvider {
  name: string;
  models: string[];
  supportsUsage: boolean;
  
  chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{
    text: string;
    usage?: Usage;
  }>;
}

/**
 * ChatProvider interface for optimizer
 * Used by API services/optimizer/optimizer.ts
 */
export interface OptimizerChatProvider {
  id: string;
  chat(args: {
    model: string;
    messages: any[]; // ChatMessage from optimizer
    maxOutputTokens?: number;
  }): Promise<{
    text: string;
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number; estimated?: boolean };
    raw?: any;
  }>;
}

/**
 * Provider Credential - Full database representation (Row)
 * Contains ciphertext (server-only)
 */
export interface ProviderCredentialRow {
  id: string;
  org_id: string;
  project_id: string | null;
  provider: "openai" | "anthropic" | "google" | "azure" | "aws";
  key_ciphertext: string; // JSON string of EncryptedKey (server-only)
  key_kid: string;
  key_fingerprint: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

/**
 * Provider Credential - DTO for API responses (no ciphertext)
 * Used by web app
 */
export interface ProviderCredential {
  id: string;
  provider: "openai" | "anthropic" | "google" | "azure" | "aws";
  key_fingerprint: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}
