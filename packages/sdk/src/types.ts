/**
 * Spectyra SDK Types
 */

export type Path = "talk" | "code";
export type Mode = "baseline" | "optimized";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated?: boolean;
}

export interface ChatResponse {
  id: string;
  created_at: string;
  mode: Mode;
  path: Path;
  optimization_level: number;
  provider: string;
  model: string;
  response_text: string;
  usage: Usage;
  cost_usd: number;
  savings?: {
    savings_type: "verified" | "estimated" | "shadow_verified";
    tokens_saved: number;
    pct_saved: number;
    cost_saved_usd: number;
    confidence_band?: "high" | "medium" | "low";
  };
  quality?: {
    pass: boolean;
    failures: string[];
  };
}

export interface SpectyraClientConfig {
  /**
   * Spectyra API base URL (e.g., "https://spectyra.up.railway.app/v1")
   */
  apiUrl: string;
  
  /**
   * Your Spectyra API key
   */
  spectyraKey: string;
  
  /**
   * LLM provider (e.g., "openai", "anthropic", "gemini", "grok")
   */
  provider: string;
  
  /**
   * Your provider API key (BYOK - Bring Your Own Key)
   * This is sent to Spectyra but never stored server-side.
   */
  providerKey: string;
}

export interface ChatOptions {
  /**
   * Model name (e.g., "gpt-4o-mini", "claude-3-5-sonnet")
   */
  model: string;
  
  /**
   * Conversation messages
   */
  messages: ChatMessage[];
  
  /**
   * Path: "talk" for chat/Q&A, "code" for coding workflows
   */
  path: Path;
  
  /**
   * Optimization level (0-4)
   * 0 = Minimal, 1 = Conservative, 2 = Balanced, 3 = Aggressive, 4 = Maximum
   */
  optimization_level?: number;
  
  /**
   * Conversation ID for state tracking (optional)
   */
  conversation_id?: string;
  
  /**
   * Dry-run mode: estimate savings without making real LLM calls
   */
  dry_run?: boolean;
}
