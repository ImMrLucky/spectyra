/**
 * Groq provider adapter.
 *
 * Groq uses an OpenAI-compatible API shape, so this adapter
 * mirrors the OpenAI adapter.
 */

import type { ProviderAdapter } from "../types.js";

/**
 * Minimal shape we expect from the Groq SDK client (OpenAI-compatible).
 */
interface GroqLike {
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

export function createGroqAdapter(): ProviderAdapter<GroqLike> {
  return {
    providerName: "groq",

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
