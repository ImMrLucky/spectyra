/**
 * Generic / fallback adapter.
 *
 * Used when no specific adapter matches the input. Treats input as a
 * plain message array. Disables unsafe advanced transforms since the
 * structure is not fully understood.
 */

import type {
  SpectyraAdapter,
  AdapterContext,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalMessage,
} from "@spectyra/canonical-model";
import { generateId, defaultSecurity } from "./helpers.js";

export interface GenericMessageRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  [key: string]: unknown;
}

export interface GenericMessageResponse {
  messages: Array<{ role: string; content: string }>;
  usage?: { inputTokens: number; outputTokens: number };
}

export class GenericAdapter implements SpectyraAdapter<GenericMessageRequest, GenericMessageResponse> {
  id = "generic";
  category = "tool" as const;

  canHandle(input: unknown): boolean {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return Array.isArray(obj.messages);
  }

  toCanonicalRequest(input: GenericMessageRequest, ctx?: AdapterContext): CanonicalRequest {
    const messages: CanonicalMessage[] = input.messages.map(m => ({
      role: (m.role === "system" || m.role === "user" || m.role === "assistant" || m.role === "tool")
        ? m.role
        : "user",
      text: m.content,
    }));

    return {
      requestId: generateId("req"),
      runId: generateId("run"),
      mode: ctx?.runModeOverride ?? "on",
      integrationType: "unknown",
      provider: input.model ? { model: input.model, apiStyle: "custom" } : undefined,
      messages,
      execution: {},
      policies: {
        prioritizeCompression: false,
      },
      security: defaultSecurity(),
    };
  }

  fromCanonicalResponse(canonical: CanonicalResponse): GenericMessageResponse {
    return {
      messages: canonical.outputMessages.map(m => ({
        role: m.role,
        content: m.text ?? "",
      })),
      usage: canonical.usage ? {
        inputTokens: canonical.usage.inputTokens ?? 0,
        outputTokens: canonical.usage.outputTokens ?? 0,
      } : undefined,
    };
  }
}
