import type { CompanionClient } from "../companion/companion-client.js";
import { buildSecurityScanEventPayload, scanPromptSecurity } from "../security/prompt-security-scanner.js";
import type { PromptSecurityScanResult } from "../security/security-types.js";
import {
  buildSecurityAlertDescriptor,
  shouldShowNonBlockingSecurityNotice,
} from "../ui/spectyra-security-alert.js";
import type { SecurityAlertDescriptor } from "../ui/spectyra-security-alert.js";
import { SafeLogger } from "../utils/safe-logger.js";

const log = new SafeLogger();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Read prompt text without mutating the host context. */
export function extractPromptText(ctx: Record<string, unknown>): string {
  const msg = ctx.message;
  if (isRecord(msg)) {
    if (typeof msg.text === "string") {
      return msg.text;
    }
    if (typeof msg.body === "string") {
      return msg.body;
    }
  }
  if (typeof ctx.text === "string") {
    return ctx.text;
  }
  return "";
}

export interface ComposerMessagePayload {
  messageId?: string;
  flowId?: string;
  text: string;
}

export interface MessageHookDeps {
  companion: CompanionClient;
  securityWarningsEnabled: () => boolean;
  showNonBlockingNotice?: (input: { title: string; markdown: string }) => void;
}

export interface BeforeMessageSendResult {
  alert: SecurityAlertDescriptor | null;
  scan: PromptSecurityScanResult | null;
}

export function beforeMessageSend(payload: ComposerMessagePayload, deps: MessageHookDeps): BeforeMessageSendResult {
  if (!deps.securityWarningsEnabled()) {
    return { alert: null, scan: null };
  }
  const result = scanPromptSecurity(payload.text, { sensitivity: "balanced" });
  if (result.findings.length === 0) {
    return { alert: null, scan: null };
  }
  deps.companion.postEvent(
    buildSecurityScanEventPayload({
      messageId: payload.messageId,
      flowId: payload.flowId,
      result,
    }),
  );
  const alert = buildSecurityAlertDescriptor(result);
  if (shouldShowNonBlockingSecurityNotice(result.level)) {
    deps.showNonBlockingNotice?.({
      title: "Spectyra — security (advisory)",
      markdown: alert.markdown,
    });
  }
  return { alert, scan: result };
}

/**
 * OpenClaw `beforeMessageSend`-style hook: advisory scan + optional notice.
 * Never throws, never mutates `ctx` or prompt text — always returns the same reference.
 */
export function runBeforeMessageSendHook(ctx: Record<string, unknown>, deps: MessageHookDeps): Record<string, unknown> {
  try {
    if (!deps.securityWarningsEnabled()) {
      return ctx;
    }
    const text = extractPromptText(ctx);
    if (!text) {
      return ctx;
    }
    const messageId = typeof ctx.messageId === "string" ? ctx.messageId : undefined;
    const flowId = typeof ctx.flowId === "string" ? ctx.flowId : undefined;
    beforeMessageSend({ text, messageId, flowId }, deps);
  } catch (e) {
    log.warn("Spectyra security scan failed safely", {
      errorClass: e instanceof Error ? e.name : "unknown",
    });
  }
  return ctx;
}
