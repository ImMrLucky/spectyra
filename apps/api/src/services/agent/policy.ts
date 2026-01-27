/**
 * Agent Policy Engine
 * 
 * Decides agent options based on prompt metadata and preferences
 * Initially uses simple heuristics, can be extended with spectral/policy engine
 */

export interface ClaudeAgentOptions {
  model?: string;
  maxBudgetUsd?: number;
  cwd?: string;
  allowedTools?: string[];
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  canUseTool?: (toolName: string, toolInput: any) => boolean | Promise<boolean>;
}

export interface DecideAgentOptionsInput {
  orgId: string;
  projectId: string | null;
  promptMeta: {
    promptChars: number;
    path?: "code" | "talk";
    repoId?: string;
    language?: string;
    filesChanged?: number;
    testCommand?: string;
  };
  preferences: {
    budgetUsd?: number;
    allowTools?: string[];
  };
}

export interface AgentDecision {
  options: ClaudeAgentOptions;
  reasons: string[];
}

/**
 * Decide agent options using policy engine
 * 
 * Currently uses simple heuristics matching SDK local mode.
 * Future: Can integrate spectral analysis, org-level policies, etc.
 */
export async function decideAgentOptions(
  input: DecideAgentOptionsInput
): Promise<AgentDecision> {
  const { promptMeta, preferences } = input;
  const reasons: string[] = [];
  
  // Determine tier by prompt length (same logic as SDK)
  let tier: "small" | "medium" | "large";
  if (promptMeta.promptChars < 6000) {
    tier = "small";
    reasons.push(`Prompt length ${promptMeta.promptChars} chars → small tier`);
  } else if (promptMeta.promptChars < 20000) {
    tier = "medium";
    reasons.push(`Prompt length ${promptMeta.promptChars} chars → medium tier`);
  } else {
    tier = "large";
    reasons.push(`Prompt length ${promptMeta.promptChars} chars → large tier`);
  }
  
  // Choose model based on tier
  let model: string;
  if (tier === "small") {
    model = "claude-3-5-haiku-latest";
    reasons.push(`Small tier → ${model}`);
  } else if (tier === "medium") {
    model = "claude-3-5-sonnet-latest";
    reasons.push(`Medium tier → ${model}`);
  } else {
    model = "claude-3-7-sonnet-latest";
    reasons.push(`Large tier → ${model}`);
  }
  
  // Set budget from preferences or default
  const maxBudgetUsd = preferences.budgetUsd || 2.5;
  reasons.push(`Budget: $${maxBudgetUsd} (from preferences or default)`);
  
  // Allowed tools from preferences or default
  const allowedTools = preferences.allowTools || ["Read", "Edit", "Bash", "Glob"];
  reasons.push(`Allowed tools: ${allowedTools.join(", ")}`);
  
  // Permission mode
  const permissionMode: "default" | "acceptEdits" | "bypassPermissions" = "acceptEdits";
  reasons.push(`Permission mode: ${permissionMode}`);
  
  // Add path-specific context
  if (promptMeta.path) {
    reasons.push(`Path: ${promptMeta.path}`);
  }
  
  // Build options
  const options: ClaudeAgentOptions = {
    model,
    maxBudgetUsd,
    allowedTools,
    permissionMode,
  };
  
  return {
    options,
    reasons,
  };
}
