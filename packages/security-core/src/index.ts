/**
 * Security core.
 *
 * Centralized enforcement of telemetry rules, prompt snapshot policy,
 * storage rules, and redaction. Used by analytics, learning, and sync
 * subsystems to ensure the security posture is never violated.
 */

import type { TelemetryMode, PromptSnapshotMode } from "@spectyra/core-types";
import type { CanonicalRequest, CanonicalSecurityMetadata } from "@spectyra/canonical-model";

// ── Policy resolution ────────────────────────────────────────────────────────

export interface ResolvedSecurityPolicy {
  canStoreLocally: boolean;
  canSyncToCloud: boolean;
  canStorePromptSnapshot: boolean;
  canStorePromptSnapshotInCloud: boolean;
  canEmitTelemetry: boolean;
  canEmitTelemetryToCloud: boolean;
  requiresRedaction: boolean;
}

export function resolvePolicy(security: CanonicalSecurityMetadata): ResolvedSecurityPolicy {
  return {
    canStoreLocally: security.telemetryMode !== "off",
    canSyncToCloud: security.allowCloudSync === true && security.telemetryMode === "cloud_redacted",
    canStorePromptSnapshot: security.promptSnapshotMode !== "none",
    canStorePromptSnapshotInCloud: security.promptSnapshotMode === "cloud_opt_in",
    canEmitTelemetry: security.telemetryMode !== "off",
    canEmitTelemetryToCloud: security.telemetryMode === "cloud_redacted",
    requiresRedaction: security.telemetryMode === "cloud_redacted" || security.containsSensitiveContent === true,
  };
}

// ── Redaction ────────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[EMAIL_REDACTED]" },
  { pattern: /\b(?:sk|pk|api|key|token|secret)[-_]?[A-Za-z0-9]{16,}\b/gi, replacement: "[KEY_REDACTED]" },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE_REDACTED]" },
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: "[SSN_REDACTED]" },
];

/**
 * Redact known sensitive patterns from text.
 */
export function redactText(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Redact a canonical request's message text for cloud-safe storage.
 */
export function redactRequest(request: CanonicalRequest): CanonicalRequest {
  return {
    ...request,
    messages: request.messages.map(m => ({
      ...m,
      text: m.text ? redactText(m.text) : m.text,
    })),
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface SecurityViolation {
  rule: string;
  detail: string;
}

/**
 * Validate that an action is allowed under the given security metadata.
 */
export function validateCloudSync(security: CanonicalSecurityMetadata): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  if (security.localOnly && security.allowCloudSync) {
    violations.push({
      rule: "LOCAL_ONLY_CONFLICT",
      detail: "localOnly is true but allowCloudSync is also true",
    });
  }

  if (security.telemetryMode === "off" && security.allowCloudSync) {
    violations.push({
      rule: "TELEMETRY_OFF_SYNC",
      detail: "telemetry is off but cloud sync is enabled",
    });
  }

  if (security.promptSnapshotMode === "none" && security.containsSensitiveContent) {
    violations.push({
      rule: "SENSITIVE_NO_SNAPSHOT",
      detail: "sensitive content flagged but prompt snapshots are disabled — review intent",
    });
  }

  return violations;
}

/**
 * Check if data should be redacted before a given destination.
 */
export function shouldRedact(
  security: CanonicalSecurityMetadata,
  destination: "local" | "cloud",
): boolean {
  if (destination === "cloud") {
    return security.telemetryMode === "cloud_redacted" || security.containsSensitiveContent === true;
  }
  return security.containsSensitiveContent === true;
}
