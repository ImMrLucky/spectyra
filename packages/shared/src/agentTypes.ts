/**
 * Agent-related types
 * Used by SDK and API agent services
 */

/**
 * Claude Agent Options
 * Compatible with Claude SDK agent options
 */
export interface ClaudeAgentOptions {
  /**
   * Model name (e.g., "claude-3-5-sonnet-latest")
   */
  model?: string;
  
  /**
   * Maximum budget in USD for this run
   */
  maxBudgetUsd?: number;
  
  /**
   * Working directory
   */
  cwd?: string;
  
  /**
   * Allowed tool names
   */
  allowedTools?: string[];
  
  /**
   * Permission mode
   */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  
  /**
   * Tool usage gate function
   */
  canUseTool?: (toolName: string, toolInput: any) => boolean | Promise<boolean>;
}

/**
 * Agent Decision
 * Result of policy engine deciding agent options
 */
export interface AgentDecision {
  /**
   * Generated agent options
   */
  options: ClaudeAgentOptions;
  
  /**
   * Decision reasons (for debugging)
   */
  reasons: string[];
}
