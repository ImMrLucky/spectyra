/**
 * Spectyra security warnings are advisory in v1.
 *
 * Intentional: many OpenClaw users run autonomous flows. This plugin must not break,
 * pause, or block those flows — no confirmation gates, no send/tool interruption.
 */

export type SecurityLevel = "info" | "low" | "medium" | "high" | "critical";

export type SecurityRecommendedAction =
  | "review_before_sending"
  | "remove_secret"
  | "rotate_secret_if_sent"
  | "use_env_reference"
  | "redact_sensitive_text"
  | "limit_private_context"
  | "verify_tool_destination"
  | "open_security_help";

export type SecurityFindingCategory =
  | "api_key"
  | "cloud_secret"
  | "env_file"
  | "private_key"
  | "auth_token"
  | "database_url"
  | "personal_data"
  | "internal_url"
  | "large_private_context"
  | "tool_risk"
  | "unknown";

export interface SecurityFinding {
  id: string;
  label: string;
  description: string;
  severity: SecurityLevel;
  category: SecurityFindingCategory;
  /** Redacted short excerpt — never the raw secret. */
  matchPreview?: string;
}

export interface PromptSecurityScanResult {
  level: SecurityLevel;
  score: number;
  findings: SecurityFinding[];
  sanitizedPreview?: string;
  advisoryOnly: true;
  recommendedActions: SecurityRecommendedAction[];
}

export interface ScanPromptOptions {
  sensitivity?: "strict" | "balanced" | "permissive";
  largePasteThreshold?: number;
}

/** @deprecated Use PromptSecurityScanResult */
export type ScanPromptResult = PromptSecurityScanResult;

/** @deprecated Use SecurityLevel */
export type SecuritySeverity = SecurityLevel;
