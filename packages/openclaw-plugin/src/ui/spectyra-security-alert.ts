import { redactText } from "../utils/redact.js";
import type { PromptSecurityScanResult, SecurityLevel, SecurityRecommendedAction } from "../security/security-types.js";

const LEVEL_RANK: Record<SecurityLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** When true, the host may show a non-blocking Spectyra notice (medium+). */
export function shouldShowNonBlockingSecurityNotice(level: SecurityLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK.medium;
}

/**
 * Spectyra security warnings are advisory in v1 — no blocking, no confirmation gates,
 * no interruption of autonomous OpenClaw flows.
 */

export const SECURITY_ALERT_ALLOWED_ACTION_LABELS = [
  "Copy Redacted Preview",
  "Open Security Tips",
  "Dismiss",
] as const;

/** UI copy that must never appear on Spectyra advisory notices (non-blocking v1). */
export const SECURITY_NOTICE_FORBIDDEN_BUTTON_SUBSTRINGS = [
  "Cancel",
  "Proceed Anyway",
  "Stop Flow",
  "Pause Flow",
  "Block",
] as const;

export interface SecurityAlertDescriptor {
  kind: "spectyra.security_alert";
  advisoryOnly: true;
  level: SecurityLevel;
  markdown: string;
  recommendedActions: SecurityRecommendedAction[];
  allowedActionLabels: readonly string[];
}

function linesForRecommended(actions: SecurityRecommendedAction[]): string[] {
  const human: Record<SecurityRecommendedAction, string> = {
    review_before_sending: "Review this prompt before sending similar content again",
    remove_secret: "Remove secrets from future prompts",
    rotate_secret_if_sent: "Rotate any credential that may have been sent",
    use_env_reference: "Use environment variable references instead of pasting keys",
    redact_sensitive_text: "Redact sensitive text when sharing logs or transcripts",
    limit_private_context: "Limit large private context pasted into the agent",
    verify_tool_destination: "Review tool destinations for sensitive data",
    open_security_help: "Open Spectyra security tips (local help)",
  };
  return [...new Set(actions)].map((a) => `- ${human[a]}`);
}

export function formatSecurityNoticeMarkdown(result: PromptSecurityScanResult): string {
  if (result.findings.length === 0) {
    return "";
  }

  const findingLines = result.findings.map((f) => `- ${f.label}`);
  const recLines = linesForRecommended(result.recommendedActions);

  if (result.level === "critical") {
    return [
      "## 🚨 Spectyra Critical Security Notice",
      "",
      "A likely credential, token, private key, or database URL was detected.",
      "",
      "Spectyra will not interrupt this autonomous flow, but you should review this immediately.",
      "",
      "**Findings:**",
      ...findingLines,
      "",
      "**Recommended:**",
      "- Rotate the exposed credential if it was sent",
      "- Remove secrets from future prompts",
      "- Use environment variables or secret managers instead",
      "",
      "**Allowed actions:**",
      "- [Copy Redacted Preview]",
      "- [Open Security Tips]",
      "- [Dismiss]",
      "",
      "_This notice is advisory only — OpenClaw continues normally._",
    ].join("\n");
  }

  return [
    "## ⚠️ Spectyra Security Notice",
    "",
    "Potential sensitive data detected.",
    "**This will not stop your OpenClaw flow.**",
    "",
    "**Findings:**",
    ...findingLines,
    "",
    "**Recommended next steps:**",
    ...recLines,
    "",
    "**Allowed actions:**",
    "- [Copy Redacted Preview]",
    "- [Open Security Tips]",
    "- [Dismiss]",
    "",
    "_Advisory only — no blocking, no confirmation required._",
  ].join("\n");
}

export function buildSecurityAlertDescriptor(result: PromptSecurityScanResult): SecurityAlertDescriptor {
  return {
    kind: "spectyra.security_alert",
    advisoryOnly: true,
    level: result.level,
    markdown: formatSecurityNoticeMarkdown(result),
    recommendedActions: result.recommendedActions,
    allowedActionLabels: SECURITY_ALERT_ALLOWED_ACTION_LABELS,
  };
}

export interface SanitizeCopyResult {
  redacted: string;
  copied: boolean;
  message: string;
}

export async function runSanitizeCopyAction(
  text: string,
  host: {
    writeClipboard?: (s: string) => Promise<void> | void;
    showReadOnlyPanel?: (title: string, body: string) => void;
  },
): Promise<SanitizeCopyResult> {
  const redacted = redactText(text);
  if (host.writeClipboard) {
    await host.writeClipboard(redacted);
    return { redacted, copied: true, message: "Redacted text copied to clipboard." };
  }
  if (host.showReadOnlyPanel) {
    host.showReadOnlyPanel("Spectyra — redacted copy", redacted);
    return { redacted, copied: false, message: "Redacted text shown in panel (clipboard API unavailable)." };
  }
  return {
    redacted,
    copied: false,
    message: "Clipboard unavailable — redacted text returned to caller only.",
  };
}
