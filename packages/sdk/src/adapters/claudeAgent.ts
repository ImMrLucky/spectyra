/**
 * Claude Agent SDK Adapter
 * 
 * Converts Spectyra decisions to Claude Agent SDK-compatible options
 */

import type { AgentDecision, ClaudeAgentOptions } from "../types.js";

/**
 * Convert agent decision to Claude Agent SDK options
 */
export function toClaudeAgentOptions(decision: AgentDecision): ClaudeAgentOptions {
  const options: ClaudeAgentOptions = {
    ...decision.options,
  };
  
  // Add default canUseTool gate if not provided
  if (!options.canUseTool) {
    options.canUseTool = (toolName: string, toolInput: any): boolean => {
      // Deny potentially dangerous Bash commands
      if (toolName === "Bash") {
        const command = typeof toolInput === "string" ? toolInput : toolInput?.command || "";
        const dangerous = ["curl", "wget", "ssh", "scp", "nc", "telnet"];
        const hasDangerous = dangerous.some(cmd => command.toLowerCase().includes(cmd));
        if (hasDangerous) {
          return false;
        }
      }
      return true;
    };
  }
  
  return options;
}
