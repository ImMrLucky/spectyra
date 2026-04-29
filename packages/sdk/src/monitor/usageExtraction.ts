import type { SpectyraMonitorPricingSource } from "./monitorTypes.js";

/** OpenAI / Groq-style `usage` object on completion responses. */
export function extractOpenAiStyleUsage(usage: unknown): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  source: SpectyraMonitorPricingSource;
} | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const prompt = typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined;
  const completion = typeof u.completion_tokens === "number" ? u.completion_tokens : undefined;
  const total = typeof u.total_tokens === "number" ? u.total_tokens : undefined;
  if (prompt == null && completion == null && total == null) return null;

  let cached: number | undefined;
  let reasoning: number | undefined;
  const pd = u.prompt_tokens_details;
  if (pd && typeof pd === "object") {
    const c = (pd as Record<string, unknown>).cached_tokens;
    if (typeof c === "number") cached = c;
  }
  const cd = u.completion_tokens_details;
  if (cd && typeof cd === "object") {
    const r = (cd as Record<string, unknown>).reasoning_tokens;
    if (typeof r === "number") reasoning = r;
  }

  return {
    inputTokens: prompt,
    outputTokens: completion,
    totalTokens: total,
    cachedInputTokens: cached,
    reasoningTokens: reasoning,
    source: "provider_usage",
  };
}

/** Best-effort usage extraction from a provider SDK completion object (metadata only). */
export function extractUsageFromProviderResult(
  providerNorm: string,
  result: unknown,
): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const p = providerNorm.toLowerCase();

  if (p === "openai" || p === "groq") {
    const u = extractOpenAiStyleUsage(r.usage);
    if (!u) return null;
    return {
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      totalTokens: u.totalTokens,
    };
  }

  if (p === "anthropic") {
    const usage = r.usage;
    if (!usage || typeof usage !== "object") return null;
    const u = usage as Record<string, unknown>;
    const input = typeof u.input_tokens === "number" ? u.input_tokens : undefined;
    const output = typeof u.output_tokens === "number" ? u.output_tokens : undefined;
    if (input == null && output == null) return null;
    return { inputTokens: input, outputTokens: output, totalTokens: input != null && output != null ? input + output : undefined };
  }

  if (p === "google-gemini" || p.includes("google")) {
    const meta = r.usageMetadata;
    if (!meta || typeof meta !== "object") return null;
    const m = meta as Record<string, unknown>;
    const input = typeof m.promptTokenCount === "number" ? m.promptTokenCount : undefined;
    const output = typeof m.candidatesTokenCount === "number" ? m.candidatesTokenCount : undefined;
    const total = typeof m.totalTokenCount === "number" ? m.totalTokenCount : undefined;
    if (input == null && output == null && total == null) return null;
    return { inputTokens: input, outputTokens: output, totalTokens: total };
  }

  return null;
}
