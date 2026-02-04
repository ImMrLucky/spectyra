/**
 * Standalone shared types for @spectyra/sdk.
 *
 * This file intentionally duplicates a minimal subset of types that previously
 * came from @spectyra/shared, so consumers can install only @spectyra/sdk.
 */

export type Path = "talk" | "code";
export type Mode = "baseline" | "optimized";

/**
 * Canonical ChatMessage type
 * Supports tool role for agent workflows
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated?: boolean;
}

/**
 * Claude Agent Options
 * Compatible with Claude SDK agent options
 */
export interface ClaudeAgentOptions {
  model?: string;
  maxBudgetUsd?: number;
  cwd?: string;
  allowedTools?: string[];
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  canUseTool?: (toolName: string, toolInput: any) => boolean | Promise<boolean>;
}

/**
 * Agent Decision
 * Result of policy engine deciding agent options
 */
export interface AgentDecision {
  options: ClaudeAgentOptions;
  reasons: string[];
}

