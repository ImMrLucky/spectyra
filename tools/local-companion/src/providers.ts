/**
 * Direct provider callers.
 *
 * The Local Companion calls the provider directly from the customer machine.
 * Provider key stays local. Spectyra cloud is never in the inference path.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChatMessage } from "./optimizer.js";
import { readOpenClawProviderKey } from "./openclawAuthFallback.js";

/** Same path the CLI sets via SPECTYRA_PROVIDER_KEYS_FILE — must work when the process is started without the CLI (e.g. `tsx src/companion.ts`, IDE run). */
const DEFAULT_PROVIDER_KEYS_FILE = join(homedir(), ".spectyra", "desktop", "provider-keys.json");
const DEFAULT_DESKTOP_CONFIG_FILE = join(homedir(), ".spectyra", "desktop", "config.json");

export interface ProviderCallResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
  /** OpenAI `choices[0].finish_reason` when present. */
  finishReason?: string | null;
  /** Full assistant `message` from OpenAI (needed when the model returns `tool_calls`). */
  openAiAssistantMessage?: Record<string, unknown>;
}

/** Client request fields to pass through to OpenAI `chat/completions` (tools, sampling, etc.). */
const OPENAI_CHAT_FORWARD_KEYS = new Set([
  "tools",
  "tool_choice",
  "response_format",
  "temperature",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "seed",
  "user",
  "n",
  "stop",
  "logit_bias",
  "parallel_tool_calls",
  "stream_options",
  "modalities",
  "reasoning_effort",
]);

export function forwardableOpenAiChatFields(body: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const k of OPENAI_CHAT_FORWARD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined) {
      out[k] = body[k];
    }
  }
  return out;
}

/**
 * Newer OpenAI models (GPT-5.x, o-series) require `max_completion_tokens` in Chat Completions.
 * Sending only `max_tokens` can error or yield broken / near-empty completions.
 */
export function openAiUsesMaxCompletionTokens(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (m.startsWith("gpt-5")) return true;
  if (m.startsWith("o1")) return true;
  if (m.startsWith("o3")) return true;
  if (m.startsWith("o4")) return true;
  return false;
}

function applyOpenAiTokenLimit(
  payload: Record<string, unknown>,
  provider: string,
  model: string,
  maxTokens: number | undefined,
): void {
  delete payload.max_tokens;
  delete payload.max_completion_tokens;
  if (maxTokens === undefined || !Number.isFinite(maxTokens)) return;
  if (provider === "openai" && openAiUsesMaxCompletionTokens(model)) {
    payload.max_completion_tokens = maxTokens;
  } else {
    payload.max_tokens = maxTokens;
  }
}

function toOpenAiApiMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    const o: Record<string, unknown> = { role: m.role };
    if (m.content !== null && m.content !== undefined) {
      o.content = m.content;
    } else if (m.role === "assistant" && m.tool_calls != null) {
      o.content = null;
    } else {
      o.content = "";
    }
    if (m.tool_calls != null) o.tool_calls = m.tool_calls;
    if (m.tool_call_id != null) o.tool_call_id = m.tool_call_id;
    if (m.name != null) o.name = m.name;
    return o;
  });
}

function normalizeKeysObject(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim().toLowerCase();
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

function readKeysFromFile(filePath: string): Record<string, string> {
  if (!filePath || !existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return normalizeKeysObject(parsed);
  } catch {
    return {};
  }
}

/** `providerKeys` object saved in desktop config.json during setup (duplicate of provider-keys.json). */
function readKeysFromDesktopConfigJson(): Record<string, string> {
  if (!existsSync(DEFAULT_DESKTOP_CONFIG_FILE)) return {};
  try {
    const dc = JSON.parse(readFileSync(DEFAULT_DESKTOP_CONFIG_FILE, "utf-8")) as Record<string, unknown>;
    const pk = dc.providerKeys;
    if (!pk || typeof pk !== "object" || Array.isArray(pk)) return {};
    return normalizeKeysObject(pk);
  } catch {
    return {};
  }
}

/**
 * Desktop writes keys to a file (avoids OS env size / escaping issues) and may also set JSON in env.
 * When `SPECTYRA_PROVIDER_KEYS_FILE` is unset, we still read `~/.spectyra/desktop/provider-keys.json`
 * so inference works whether the companion was started via `spectyra-companion start` or directly.
 *
 * Merge order (later overwrites earlier): config.json `providerKeys` → provider-keys file(s) →
 * `SPECTYRA_PROVIDER_KEYS_JSON`.
 */
function parseSessionKeys(): Record<string, string> {
  const explicit = process.env.SPECTYRA_PROVIDER_KEYS_FILE?.trim();
  let merged: Record<string, string> = {};

  if (!explicit) {
    merged = { ...merged, ...readKeysFromDesktopConfigJson() };
    merged = { ...merged, ...readKeysFromFile(DEFAULT_PROVIDER_KEYS_FILE) };
  } else {
    merged = { ...merged, ...readKeysFromFile(explicit) };
  }

  const raw = process.env.SPECTYRA_PROVIDER_KEYS_JSON;
  if (raw?.trim()) {
    try {
      merged = { ...merged, ...normalizeKeysObject(JSON.parse(raw) as unknown) };
    } catch {
      /* ignore */
    }
  }

  return merged;
}

/** Parse on each read so a restarted companion process always sees the latest env from the desktop parent. */
export function getProviderKey(provider: string): string {
  const keys = parseSessionKeys();
  const p = provider.trim().toLowerCase();
  const fromSession = keys[provider] ?? keys[p];
  if (fromSession && fromSession.length > 0) return fromSession;
  switch (p) {
    case "openai": {
      const env = (process.env.OPENAI_API_KEY || "").trim();
      if (env) return env;
      return readOpenClawProviderKey("openai") ?? "";
    }
    case "anthropic": {
      const env = (process.env.ANTHROPIC_API_KEY || "").trim();
      if (env) return env;
      return readOpenClawProviderKey("anthropic") ?? "";
    }
    case "groq": {
      const env = (process.env.GROQ_API_KEY || "").trim();
      if (env) return env;
      return readOpenClawProviderKey("groq") ?? "";
    }
    default:
      return "";
  }
}

/** True when an API key is available for the given provider id (no key material returned). */
export function isProviderKeyConfigured(provider: string): boolean {
  return getProviderKey(provider).length > 0;
}

/**
 * OpenAI-compatible streaming completion. Caller pipes `response.body` to the client.
 * Required for OpenClaw (stream: true): tool_calls, reasoning, and chunk deltas must match upstream.
 */
export async function openAiChatCompletionStreaming(
  provider: "openai" | "groq",
  model: string,
  messages: ChatMessage[],
  maxTokens: number | undefined,
  openAiForward: Record<string, unknown> | undefined,
): Promise<Response> {
  const key = getProviderKey(provider);
  if (!key) {
    throw new Error(
      `Provider key not configured for ${provider}. Add it to ~/.spectyra/desktop/provider-keys.json, ` +
        `or ${provider.toUpperCase()}_API_KEY in the environment, or re-run spectyra-companion setup.`,
    );
  }
  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const payload: Record<string, unknown> = {
    model,
    messages: toOpenAiApiMessages(messages),
    stream: true,
    ...(openAiForward ?? {}),
  };
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;
  /** So the last SSE chunk can include token usage (OpenAI; ignored by Groq if unsupported). */
  if (provider === "openai" && payload.stream_options == null) {
    payload.stream_options = { include_usage: true };
  }

  return fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
}

export async function callProvider(
  provider: string,
  model: string,
  messages: ChatMessage[],
  maxTokens?: number,
  /** From `/v1/chat/completions` body — tools, tool_choice, temperature, etc. */
  openAiForward?: Record<string, unknown>,
): Promise<ProviderCallResult> {
  const key = getProviderKey(provider);
  if (!key) {
    throw new Error(
      `Provider key not configured for ${provider}. Add it to ~/.spectyra/desktop/provider-keys.json, ` +
        `or ${provider.toUpperCase()}_API_KEY in the environment, or re-run spectyra-companion setup.`,
    );
  }

  if (provider === "openai" || provider === "groq") {
    const baseUrl = provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const payload: Record<string, unknown> = {
      model,
      messages: toOpenAiApiMessages(messages),
      ...(openAiForward ?? {}),
    };
    applyOpenAiTokenLimit(payload, provider, model, maxTokens);

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${provider} API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    const apiMsg = data.choices?.[0]?.message;
    const text = typeof apiMsg?.content === "string" ? apiMsg.content : "";
    const assistantObj =
      apiMsg && typeof apiMsg === "object" && !Array.isArray(apiMsg)
        ? { ...(apiMsg as Record<string, unknown>) }
        : undefined;
    return {
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      raw: data,
      finishReason: data.choices?.[0]?.finish_reason ?? null,
      openAiAssistantMessage: assistantObj,
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
        messages: nonSystem.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content ?? "",
        })),
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
