/**
 * Canonical response schema.
 *
 * After the provider returns, the adapter translates the vendor response
 * into this form for post-run analysis and reporting.
 */

import type { CanonicalMessage } from "./request.js";

export interface CanonicalToolCall {
  id?: string;
  name: string;
  argumentsJson?: unknown;
}

export interface CanonicalUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface CanonicalResponse {
  requestId: string;
  outputMessages: CanonicalMessage[];
  toolCalls?: CanonicalToolCall[];
  usage?: CanonicalUsage;
  latencyMs?: number;
  finishReason?: string;
  metadata?: Record<string, unknown>;
}
