/**
 * Audit Logging Service
 * 
 * Enterprise Security: Records all security-relevant actions for compliance
 * 
 * Usage:
 *   await audit(ctx, 'KEY_CREATED', { targetId: keyId, metadata: { name: 'My Key' } });
 */

import { query } from "../storage/db.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { safeLog } from "../../utils/redaction.js";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "KEY_CREATED"
  | "KEY_ROTATED"
  | "KEY_REVOKED"
  | "SETTINGS_UPDATED"
  | "EXPORT_DATA"
  | "PROVIDER_KEY_SET"
  | "PROVIDER_KEY_REVOKED"
  | "RETENTION_APPLIED"
  | "ORG_CREATED"
  | "ORG_DELETED"
  | "PROJECT_CREATED"
  | "PROJECT_DELETED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "ROLE_CHANGED"
  | "SDK_ACCESS_TOGGLED";

export type AuditTargetType =
  | "API_KEY"
  | "ORG"
  | "PROJECT"
  | "PROVIDER_KEY"
  | "ORG_SETTINGS"
  | "PROJECT_SETTINGS"
  | "ORG_MEMBERSHIP"
  | "AUDIT_LOG";

export interface AuditOptions {
  projectId?: string | null;
  targetType?: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

/**
 * Record an audit log entry
 * 
 * @param req Authenticated request (provides orgId, userId/apiKeyId, etc.)
 * @param action Action performed
 * @param options Additional audit context
 */
export async function audit(
  req: AuthenticatedRequest,
  action: AuditAction,
  options: AuditOptions = {}
): Promise<void> {
  try {
    const context = req.context || req.auth;
    if (!context) {
      safeLog("warn", "Audit called without authenticated context", { action });
      return;
    }

    const orgId = (context as any).org?.id ?? (context as any).orgId;
    if (!orgId) {
      safeLog("warn", "Audit called without orgId", { action });
      return;
    }

    // Determine actor
    let actorType: "USER" | "API_KEY" | "SYSTEM" = "SYSTEM";
    let actorId = "system";

    if (context.userId) {
      actorType = "USER";
      actorId = context.userId;
    } else if (context.apiKeyId) {
      actorType = "API_KEY";
      actorId = context.apiKeyId;
    }

    // Get IP and user agent from request
    const ip = options.ip || (req as any).ip || req.socket?.remoteAddress || null;
    const userAgent = options.userAgent || req.headers["user-agent"] || null;

    // Redact sensitive data from metadata
    const metadata = options.metadata ? redactMetadata(options.metadata) : null;

    await query(`
      INSERT INTO audit_logs (
        org_id, project_id,
        actor_type, actor_id,
        action, target_type, target_id,
        ip, user_agent, metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
    `, [
      orgId,
      options.projectId ?? ((context as any).project?.id ?? (context as any).projectId ?? null),
      actorType,
      actorId,
      action,
      options.targetType ?? null,
      options.targetId ?? null,
      ip,
      userAgent,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  } catch (error: any) {
    // Audit logging should never break the request
    // Log error but don't throw
    safeLog("error", "Failed to write audit log", {
      action,
      error: error.message,
    });
  }
}

/**
 * Redact sensitive data from audit metadata
 */
function redactMetadata(metadata: Record<string, any>): Record<string, any> {
  const redacted = { ...metadata };
  const sensitiveKeys = ["key", "password", "secret", "token", "apiKey", "api_key"];

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      redacted[key] = "[REDACTED]";
    }
  }

  return redacted;
}

/**
 * System audit (for automated actions)
 */
export async function systemAudit(
  orgId: string,
  action: AuditAction,
  options: Omit<AuditOptions, "ip" | "userAgent"> = {}
): Promise<void> {
  try {
    const metadata = options.metadata ? redactMetadata(options.metadata) : null;

    await query(`
      INSERT INTO audit_logs (
        org_id, project_id,
        actor_type, actor_id,
        action, target_type, target_id,
        metadata,
        created_at
      ) VALUES ($1, $2, 'SYSTEM', 'system', $3, $4, $5, $6, now())
    `, [
      orgId,
      options.projectId || null,
      action,
      options.targetType || null,
      options.targetId || null,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  } catch (error: any) {
    safeLog("error", "Failed to write system audit log", {
      action,
      error: error.message,
    });
  }
}
