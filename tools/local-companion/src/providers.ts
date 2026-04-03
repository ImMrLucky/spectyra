/**
 * Direct provider callers.
 *
 * The Local Companion calls the provider directly from the customer machine.
 * Provider key stays local. Spectyra cloud is never in the inference path.
 */

import type { ChatMessage } from "./optimizer.js";

export interface ProviderCallResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
}

function parseSessionKeys(): Record<string, string> {
  const raw = process.env.SPECTYRA_PROVIDER_KEYS_JSON;
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

const sessionKeys = parseSessionKeys();

export function getProviderKey(provider: string): string {
  const fromSession = sessionKeys[provider];
  if (fromSession) return fromSession;
  switch (provider) {
    case "openai": return process.env.OPENAI_API_KEY || "";
    case "anthropic": return process.env.ANTHROPIC_API_KEY || "";
    case "groq": return process.env.GROQ_API_KEY || "";
    default: return "";
  }
}

/** True when an API key is available for the given provider id (no key material returned). */
export function isProviderKeyConfigured(provider: string): boolean {
  return getProviderKey(provider).length > 0;
}

export async function callProvider(
  provider: string,
  model: string,
  messages: ChatMessage[],
  maxTokens?: number,
): Promise<ProviderCallResult> {
  const key = getProviderKey(provider);
  if (!key) throw new Error(`Provider key not configured for ${provider}. Set ${provider.toUpperCase()}_API_KEY.`);

  if (provider === "openai" || provider === "groq") {
    const baseUrl = provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`${provider} API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      raw: data,
    };
  }

  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: nonSystem.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text: data.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") ?? "",
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      raw: data,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
