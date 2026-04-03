import type { SessionMetadataHeaders } from "./types.js";

function safeToken(s: string): string {
  return s.replace(/[^\w\-:.@/]/g, "_").slice(0, 256);
}

export interface SessionMetadataInput {
  sessionId?: string;
  runContext?: string;
  /** Default `openclaw` — override for other agent adapters using the same Local Companion. */
  integration?: string;
}

/**
 * Optional request annotations for clients that support custom headers.
 * Purely local metadata — no network I/O, no optimization.
 */
export function buildSessionMetadataHeaders(input: SessionMetadataInput = {}): SessionMetadataHeaders {
  const sessionId = input.sessionId?.trim() || `sess_${Date.now().toString(36)}`;
  const runContext = input.runContext?.trim() || "unspecified";
  const integration = input.integration?.trim() || "openclaw";

  return {
    "X-Spectyra-Session-Id": safeToken(sessionId),
    "X-Spectyra-Run-Context": safeToken(runContext),
    "X-Spectyra-Integration": safeToken(integration),
  };
}
