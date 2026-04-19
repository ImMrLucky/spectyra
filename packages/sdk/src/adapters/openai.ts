/**
 * OpenAI provider adapter.
 *
 * Wraps an OpenAI SDK client instance so Spectyra can call it
 * while keeping the provider key and billing in the customer environment.
 *
 * The OpenAI SDK is NOT a dependency of @spectyra/sdk — the customer
 * passes their own instantiated client.
 */

import type { ProviderAdapter } from "../types.js";
import type { ChatMessage } from "../sharedTypes.js";

/**
 * Minimal shape we expect from the OpenAI SDK client.
 * We avoid importing the openai package directly.
 */
function wireOpenAiMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    const row: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.tool_calls != null) row.tool_calls = m.tool_calls;
    if (m.tool_call_id != null) row.tool_call_id = m.tool_call_id;
    if (m.name != null) row.name = m.name;
    return row;
  });
}

interface OpenAILike {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: unknown[];
        max_tokens?: number;
        temperature?: number;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      }>;
    };
  };
}

export function createOpenAIAdapter(): ProviderAdapter<OpenAILike> {
  return {
    providerName: "openai",

    async call({ client, model, messages, maxTokens, temperature }) {
      const result = await client.chat.completions.create({
        model,
        messages: wireOpenAiMessages(messages),
        max_tokens: maxTokens,
        temperature,
      });

      const text = result.choices?.[0]?.message?.content ?? "";
      const usage = result.usage
        ? { inputTokens: result.usage.prompt_tokens, outputTokens: result.usage.completion_tokens }
        : { inputTokens: 0, outputTokens: 0 };

      return { result, text, usage };
    },
  };
}
