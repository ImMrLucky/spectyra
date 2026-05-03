import type { DetectedProvider, Evidence } from "./types.js";

const URL_TO_PROVIDER: Array<{ re: RegExp; provider: DetectedProvider["provider"] }> = [
  { re: /api\.openai\.com/i, provider: "openai" },
  { re: /api\.anthropic\.com/i, provider: "anthropic" },
  { re: /api\.groq\.com|\.groq\.com/i, provider: "groq" },
  { re: /generativelanguage\.googleapis\.com/i, provider: "google-gemini" },
  { re: /openai\.azure\.com/i, provider: "azure-openai" },
  { re: /bedrock-runtime.*amazonaws\.com/i, provider: "aws-bedrock" },
  { re: /api\.mistral\.ai/i, provider: "mistral" },
  { re: /api\.cohere\.ai|\.cohere\.ai/i, provider: "cohere" },
  { re: /openrouter\.ai/i, provider: "openrouter" },
  { re: /api\.together\.xyz/i, provider: "together" },
  { re: /api\.perplexity\.ai/i, provider: "perplexity" },
  { re: /localhost:11434|127\.0\.0\.1:11434/i, provider: "ollama" },
];

const PATH_HINTS = [/\/v1\/chat\/completions/i, /\/chat\/completions/i, /\/api\/chat\b/i];

const ENV_NAMES = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "OPENROUTER_API_KEY",
  "TOGETHER_API_KEY",
  "PERPLEXITY_API_KEY",
  "OLLAMA_HOST",
  "GROQ_BASE_URL",
  "OPENAI_BASE_URL",
  "LLM_BASE_URL",
];

const ENV_TO_PROVIDER: Record<string, DetectedProvider["provider"]> = {
  OPENAI_API_KEY: "openai",
  ANTHROPIC_API_KEY: "anthropic",
  GROQ_API_KEY: "groq",
  GEMINI_API_KEY: "google-gemini",
  GOOGLE_API_KEY: "google-gemini",
  AZURE_OPENAI_API_KEY: "azure-openai",
  MISTRAL_API_KEY: "mistral",
  COHERE_API_KEY: "cohere",
  OPENROUTER_API_KEY: "openrouter",
  TOGETHER_API_KEY: "together",
  PERPLEXITY_API_KEY: "perplexity",
  OLLAMA_HOST: "ollama",
  GROQ_BASE_URL: "groq",
  OPENAI_BASE_URL: "unknown-openai-compatible",
  LLM_BASE_URL: "unknown-openai-compatible",
};

export function scanTextForProviders(content: string, file: string): DetectedProvider[] {
  const found = new Map<DetectedProvider["provider"], Evidence[]>();

  for (const { re, provider } of URL_TO_PROVIDER) {
    if (re.test(content)) {
      const ev = found.get(provider) ?? [];
      ev.push({ kind: "url", detail: re.source, file });
      found.set(provider, ev);
    }
  }

  for (const env of ENV_NAMES) {
    const re = new RegExp(`\\b${env}\\b`);
    if (re.test(content)) {
      const p = ENV_TO_PROVIDER[env] ?? "unknown-openai-compatible";
      const ev = found.get(p) ?? [];
      ev.push({ kind: "env", detail: env, file });
      found.set(p, ev);
    }
  }

  const hasOpenAiPath = PATH_HINTS.some((h) => h.test(content));
  if (hasOpenAiPath && !found.has("groq") && !found.has("openai")) {
    const ev: Evidence[] = [{ kind: "pattern", detail: "OpenAI-compatible path (/chat/completions)", file }];
    found.set("unknown-openai-compatible", ev);
  }

  const out: DetectedProvider[] = [];
  for (const [provider, evidence] of found) {
    const high = evidence.some((e) => e.kind === "url");
    out.push({
      provider,
      confidence: high ? "high" : evidence.length > 1 ? "medium" : "low",
      evidence,
    });
  }
  return out;
}

export function mergeProviders(rows: DetectedProvider[][]): DetectedProvider[] {
  const map = new Map<DetectedProvider["provider"], Evidence[]>();
  for (const row of rows) {
    for (const p of row) {
      const prev = map.get(p.provider) ?? [];
      map.set(p.provider, [...prev, ...p.evidence]);
    }
  }
  return [...map.entries()].map(([provider, evidence]) => ({
    provider,
    confidence: evidence.some((e) => e.kind === "url") ? "high" : "medium",
    evidence,
  }));
}
