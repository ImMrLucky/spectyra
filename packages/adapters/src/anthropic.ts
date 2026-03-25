/**
 * Anthropic adapter.
 *
 * Translates Anthropic Messages API request/response format to/from
 * the canonical model.
 */

import type {
  SpectyraAdapter,
  AdapterContext,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalMessage,
  CanonicalToolDefinition,
  CanonicalExecutionMetadata,
  UsageEstimate,
} from "@spectyra/canonical-model";
import { generateId, estimateTokens, defaultSecurity, defaultExecution } from "./helpers.js";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  tools?: Array<{ name: string; description?: string; input_schema?: unknown }>;
  temperature?: number;
  [key: string]: unknown;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

function extractText(content: AnthropicMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.filter(p => p.type === "text").map(p => p.text ?? "").join("");
}

export class AnthropicAdapter implements SpectyraAdapter<AnthropicRequest, AnthropicResponse> {
  id = "anthropic";
  category = "provider" as const;

  canHandle(input: unknown): boolean {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return typeof obj.model === "string" && Array.isArray(obj.messages) && typeof obj.max_tokens === "number";
  }

  toCanonicalRequest(input: AnthropicRequest, ctx?: AdapterContext): CanonicalRequest {
    const requestId = generateId("req");
    const runId = generateId("run");

    const messages: CanonicalMessage[] = [];
    if (input.system) {
      messages.push({ role: "system", text: input.system });
    }
    for (const m of input.messages) {
      messages.push({ role: m.role, text: extractText(m.content) });
    }

    const tools: CanonicalToolDefinition[] | undefined = input.tools?.map((t, i) => ({
      id: `tool_${i}`,
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema,
    }));

    return {
      requestId,
      runId,
      mode: ctx?.runModeOverride ?? "on",
      integrationType: "sdk-wrapper",
      provider: { vendor: "anthropic", model: input.model, apiStyle: "anthropic" },
      messages,
      tools: tools?.length ? tools : undefined,
      execution: defaultExecution(),
      security: defaultSecurity(),
    };
  }

  fromCanonicalResponse(canonical: CanonicalResponse, originalInput: AnthropicRequest): AnthropicResponse {
    const content: AnthropicResponse["content"] = [];

    for (const msg of canonical.outputMessages) {
      if (msg.text) content.push({ type: "text", text: msg.text });
    }
    if (canonical.toolCalls) {
      for (const tc of canonical.toolCalls) {
        content.push({ type: "tool_use", id: tc.id ?? generateId("tu"), name: tc.name, input: tc.argumentsJson ?? {} });
      }
    }

    return {
      id: canonical.requestId,
      type: "message",
      role: "assistant",
      content,
      model: originalInput.model,
      stop_reason: canonical.finishReason ?? "end_turn",
      usage: {
        input_tokens: canonical.usage?.inputTokens ?? 0,
        output_tokens: canonical.usage?.outputTokens ?? 0,
      },
    };
  }

  extractExecutionMetadata(input: AnthropicRequest): Partial<CanonicalExecutionMetadata> {
    return {
      supportsTools: !!input.tools?.length,
      supportsFunctionCalling: !!input.tools?.length,
    };
  }

  estimateExternalUsage(input: AnthropicRequest): Partial<UsageEstimate> {
    let chars = (input.system?.length ?? 0);
    for (const m of input.messages) chars += (typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length);
    return { estimatedInputTokens: estimateTokens(String(chars)) };
  }
}
