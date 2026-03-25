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
interface OpenAILike {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: Array<{ role: string; content: string }>;
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
