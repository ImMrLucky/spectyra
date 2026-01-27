/**
 * Local Agent Decision Engine
 * 
 * Makes local decisions about agent options without requiring API calls.
 * This is the default "SDK mode" - works offline.
 */

import type { SpectyraConfig, SpectyraCtx, PromptMeta, AgentDecision, ClaudeAgentOptions } from "../types.js";

export interface DecideAgentInput {
  config: SpectyraConfig;
  ctx: SpectyraCtx;
  prompt: string | PromptMeta;
}

/**
 * Determine agent options locally based on prompt characteristics
 */
export function decideAgent(input: DecideAgentInput): AgentDecision {
  const { config, ctx, prompt } = input;
  
  const reasons: string[] = [];
  
  // Determine prompt length
  const promptLength = typeof prompt === "string" ? prompt.length : prompt.promptChars;
  const path = typeof prompt === "string" ? undefined : prompt.path;
  
  // Determine tier by prompt length
  let tier: "small" | "medium" | "large";
  if (promptLength < 6000) {
    tier = "small";
    reasons.push(`Prompt length ${promptLength} chars → small tier`);
  } else if (promptLength < 20000) {
    tier = "medium";
    reasons.push(`Prompt length ${promptLength} chars → medium tier`);
  } else {
    tier = "large";
    reasons.push(`Prompt length ${promptLength} chars → large tier`);
  }
  
  // Choose model from config or defaults
  const modelDefaults = config.defaults?.models || {};
  let model: string;
  
  if (tier === "small") {
    model = modelDefaults.small || "claude-3-5-haiku-latest";
    reasons.push(`Small tier → ${model}`);
  } else if (tier === "medium") {
    model = modelDefaults.medium || "claude-3-5-sonnet-latest";
    reasons.push(`Medium tier → ${model}`);
  } else {
    model = modelDefaults.large || "claude-3-7-sonnet-latest";
    reasons.push(`Large tier → ${model}`);
  }
  
  // Set budget
  const maxBudgetUsd = ctx.budgetUsd || config.defaults?.budgetUsd || 2.5;
  reasons.push(`Budget: $${maxBudgetUsd} (from ctx or defaults)`);
  
  // Default allowed tools (configurable)
  const allowedTools = ["Read", "Edit", "Bash", "Glob"];
  reasons.push(`Allowed tools: ${allowedTools.join(", ")}`);
  
  // Permission mode
  const permissionMode: "default" | "acceptEdits" | "bypassPermissions" = "acceptEdits";
  reasons.push(`Permission mode: ${permissionMode}`);
  
  // Build options
  const options: ClaudeAgentOptions = {
    model,
    maxBudgetUsd,
    allowedTools,
    permissionMode,
    // canUseTool will be set by adapter if needed
  };
  
  // Add path-specific context if available
  if (path) {
    reasons.push(`Path: ${path}`);
  }
  
  return {
    options,
    reasons,
  };
}
