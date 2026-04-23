/**
 * Local companion adapter.
 *
 * Translates the local companion's internal request shape into canonical
 * form. The companion receives OpenAI-style or Anthropic-style requests
 * from external tools, but by the time it calls the optimizer, it uses
 * a simplified internal format.
 */

import type {
  SpectyraAdapter,
  AdapterContext,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalMessage,
} from "@spectyra/canonical-model";
import { generateId, defaultSecurity } from "./helpers.js";

export interface CompanionInternalRequest {
  model: string;
  provider: string;
  messages: Array<{ role: string; content: string }>;
  runMode?: import("@spectyra/core-types").SpectyraRunMode;
}

export interface CompanionInternalResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class LocalCompanionAdapter implements SpectyraAdapter<CompanionInternalRequest, CompanionInternalResponse> {
  id = "local-companion";
  category = "companion" as const;

  canHandle(input: unknown): boolean {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return typeof obj.model === "string" && typeof obj.provider === "string" && Array.isArray(obj.messages);
  }

  toCanonicalRequest(input: CompanionInternalRequest, ctx?: AdapterContext): CanonicalRequest {
    const messages: CanonicalMessage[] = input.messages.map(m => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content,
    }));

    return {
      requestId: generateId("req"),
      runId: generateId("run"),
      mode: ctx?.runModeOverride ?? input.runMode ?? "on",
      integrationType: "local-companion",
      provider: { vendor: input.provider, model: input.model, apiStyle: "openai_compatible" },
      messages,
      execution: {},
      security: defaultSecurity(),
    };
  }

  fromCanonicalResponse(canonical: CanonicalResponse): CompanionInternalResponse {
    return {
      text: canonical.outputMessages.map(m => m.text ?? "").join(""),
      usage: {
        inputTokens: canonical.usage?.inputTokens ?? 0,
        outputTokens: canonical.usage?.outputTokens ?? 0,
      },
    };
  }
}
