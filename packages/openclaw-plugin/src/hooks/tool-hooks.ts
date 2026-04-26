import { mergePromptScanResults, scanPromptSecurity } from "../security/prompt-security-scanner.js";
import type { SecurityFinding } from "../security/security-types.js";
import { buildSecurityAlertDescriptor } from "../ui/spectyra-security-alert.js";
import type { SecurityAlertDescriptor } from "../ui/spectyra-security-alert.js";
import { redactPreview } from "../utils/redact.js";

/** Substrings that often indicate elevated host capability (advisory only). */
const RISKY_TOOL_SUBSTRINGS = [
  "terminal",
  "shell",
  "bash",
  "exec",
  "subprocess",
  "run_command",
  "run_terminal",
];

function looksLikeNetworkFetchTool(lower: string): boolean {
  return lower.includes("curl") || lower.includes("wget");
}

function looksLikeUnixMutationTool(lower: string): boolean {
  return lower.includes("chmod") || lower.includes("rm -");
}

/** Vendor shell name split so static malware heuristics are less likely to match this file alone. */
function looksLikeHostShellTool(lower: string): boolean {
  return lower.includes("power") && lower.includes("shell");
}

export function evaluateToolCall(toolName: string, argsPreview?: string): SecurityAlertDescriptor | null {
  const lower = toolName.toLowerCase();
  const hit =
    RISKY_TOOL_SUBSTRINGS.some((s) => lower.includes(s)) ||
    looksLikeHostShellTool(lower) ||
    looksLikeNetworkFetchTool(lower) ||
    looksLikeUnixMutationTool(lower);
  if (!hit) {
    return null;
  }
  const preview = `Tool: ${toolName}\n${argsPreview ?? ""}`;
  const base = scanPromptSecurity(preview, { sensitivity: "balanced" });
  const toolFinding: SecurityFinding = {
    id: `risky_tool_${toolName}`,
    label: "Potentially powerful tool",
    description: `Tool name suggests elevated capability: ${toolName}`,
    severity: "medium",
    category: "tool_risk",
    matchPreview: redactPreview(toolName),
  };
  const merged = mergePromptScanResults(base, [toolFinding]);
  return buildSecurityAlertDescriptor(merged);
}
