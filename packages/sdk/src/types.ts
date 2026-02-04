/**
 * Spectyra SDK Types
 * 
 * Core types for SDK-first agentic integration
 */

// ============================================================================
// Core Configuration Types
// ============================================================================

export type SpectyraMode = "local" | "api";

export interface SpectyraConfig {
  /**
   * SDK mode: "local" (default, no proxy) or "api" (remote control plane)
   */
  mode?: SpectyraMode;
  
  /**
   * Spectyra API endpoint (required for "api" mode, optional for "local")
   * Example: "https://spectyra.up.railway.app/v1"
   */
  endpoint?: string;
  
  /**
   * Spectyra API key (required for "api" mode, optional for "local")
   */
  apiKey?: string;
  
  /**
   * Default settings
   */
  defaults?: {
    /**
     * Default budget in USD per agent run
     */
    budgetUsd?: number;
    
    /**
     * Model preferences by tier
     */
    models?: {
      small?: string;
      medium?: string;
      large?: string;
    };
  };
}

export interface SpectyraCtx {
  /**
   * Organization ID (optional; in API mode server derives from API key)
   */
  orgId?: string;
  
  /**
   * Project ID (optional)
   */
  projectId?: string;
  
  /**
   * Run ID for tracking this agent session
   */
  runId?: string;
  
  /**
   * Budget in USD for this run
   */
  budgetUsd?: number;
  
  /**
   * Tags for filtering/analytics
   */
  tags?: Record<string, string>;
}

export interface PromptMeta {
  /**
   * Prompt character count (to avoid sending full prompt by default)
   */
  promptChars: number;
  
  /**
   * Path: "code" for coding, "talk" for chat/Q&A
   */
  path?: "code" | "talk";
  
  /**
   * Repository identifier (optional)
   */
  repoId?: string;
  
  /**
   * Programming language (optional)
   */
  language?: string;
  
  /**
   * Number of files changed (optional)
   */
  filesChanged?: number;
  
  /**
   * Test command (optional)
   */
  testCommand?: string;
}

// ============================================================================
// ============================================================================
// Remote API Types
// ============================================================================

export interface AgentOptionsRequest {
  run_id?: string;
  prompt_meta: PromptMeta;
  preferences?: {
    budgetUsd?: number;
    allowTools?: string[];
  };
}

export interface AgentOptionsResponse {
  run_id: string;
  options: ClaudeAgentOptions;
  reasons: string[];
}

export interface AgentEventRequest {
  run_id: string;
  event: any; // Raw SDK event (JSONB)
}

export interface AgentEventResponse {
  ok: boolean;
}

// ============================================================================
// Legacy Types (for backwards compatibility)
// ============================================================================

import type { Path, Mode, ChatMessage, Usage, ClaudeAgentOptions, AgentDecision } from "./sharedTypes.js";

// Re-export canonical types
export type { Path, Mode, ChatMessage, Usage, ClaudeAgentOptions, AgentDecision };

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
