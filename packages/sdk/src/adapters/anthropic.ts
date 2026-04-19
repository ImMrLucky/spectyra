/**
 * Anthropic provider adapter.
 *
 * Wraps an Anthropic SDK client instance so Spectyra can call it
 * while keeping the provider key and billing in the customer environment.
 */

import type { ProviderAdapter } from "../types.js";
import type { ChatMessage } from "../sharedTypes.js";

/**
 * Minimal shape we expect from the Anthropic SDK client.
 */
interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export function createAnthropicAdapter(): ProviderAdapter<AnthropicLike> {
  return {
    providerName: "anthropic",

    async call({ client, model, messages, maxTokens, temperature }) {
      const systemMsg = messages.find((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");

      const result = await client.messages.create({
        model,
        max_tokens: maxTokens ?? 4096,
        system: systemMsg?.content ?? undefined,
        messages: nonSystem.map((m) => ({ role: m.role, content: m.content ?? "" })),
        temperature,
      });

      const text = result.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("") ?? "";

      const usage = result.usage
        ? { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens }
        : { inputTokens: 0, outputTokens: 0 };

      return { result, text, usage };
    },
  };
}
