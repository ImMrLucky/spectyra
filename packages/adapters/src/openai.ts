/**
 * OpenAI adapter.
 *
 * Translates OpenAI chat completion request/response format to/from
 * the canonical model. No optimization logic here.
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

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string | null;
  name?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  tools?: Array<{ type: "function"; function: { name: string; description?: string; parameters?: unknown } }>;
  max_tokens?: number;
  temperature?: number;
  [key: string]: unknown;
}

export interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

export class OpenAIAdapter implements SpectyraAdapter<OpenAIChatRequest, OpenAIChatResponse> {
  id = "openai";
  category = "provider" as const;

  canHandle(input: unknown): boolean {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return typeof obj.model === "string" && Array.isArray(obj.messages);
  }

  toCanonicalRequest(input: OpenAIChatRequest, ctx?: AdapterContext): CanonicalRequest {
    const requestId = generateId("req");
    const runId = generateId("run");

    const messages: CanonicalMessage[] = input.messages.map(m => ({
      role: m.role === "function" ? "tool" : m.role as CanonicalMessage["role"],
      text: m.content ?? undefined,
      name: m.name,
    }));

    const tools: CanonicalToolDefinition[] | undefined = input.tools?.map((t, i) => ({
      id: `tool_${i}`,
      name: t.function.name,
      description: t.function.description,
      inputSchema: t.function.parameters,
    }));

    return {
      requestId,
      runId,
      mode: ctx?.runModeOverride ?? "on",
      integrationType: "sdk-wrapper",
      provider: { vendor: "openai", model: input.model, apiStyle: "openai" },
      messages,
      tools: tools?.length ? tools : undefined,
      execution: defaultExecution(),
      security: defaultSecurity(),
    };
  }

  fromCanonicalResponse(canonical: CanonicalResponse, originalInput: OpenAIChatRequest): OpenAIChatResponse {
    const content = canonical.outputMessages.map(m => m.text ?? "").join("");
    const toolCalls = canonical.toolCalls?.map(tc => ({
      id: tc.id ?? generateId("call"),
      type: "function" as const,
      function: { name: tc.name, arguments: typeof tc.argumentsJson === "string" ? tc.argumentsJson : JSON.stringify(tc.argumentsJson ?? {}) },
    }));

    return {
      id: canonical.requestId,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: content || null,
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: canonical.finishReason ?? "stop",
      }],
      usage: canonical.usage ? {
        prompt_tokens: canonical.usage.inputTokens ?? 0,
        completion_tokens: canonical.usage.outputTokens ?? 0,
        total_tokens: canonical.usage.totalTokens ?? 0,
      } : undefined,
      model: originalInput.model,
    };
  }

  extractExecutionMetadata(input: OpenAIChatRequest): Partial<CanonicalExecutionMetadata> {
    return {
      supportsTools: !!input.tools?.length,
      supportsFunctionCalling: !!input.tools?.length,
      supportsStructuredOutput: !!input.tools?.length,
    };
  }

  estimateExternalUsage(input: OpenAIChatRequest): Partial<UsageEstimate> {
    let chars = 0;
    for (const m of input.messages) chars += (m.content?.length ?? 0) + m.role.length + 4;
    return { estimatedInputTokens: estimateTokens(String(chars)) };
  }
}
