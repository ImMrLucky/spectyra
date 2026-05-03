import type { ModelClassification } from "./types.js";

const EMBEDDING = /text-embedding|embedding-3|embed/i;
const REASONING = /\bo[134]\b|gpt-5|reasoning/i;
const EXPENSIVE = /gpt-4(?!o-mini)|claude-3-opus|claude-opus|gpt-4o(?!-mini)|70b|sonnet-4|opus-4/i;
const CHEAP = /mini|nano|haiku|8b|3\.5-haiku|gpt-4o-mini|gpt-4\.1-mini/i;

export function classifyModelHint(raw: string): ModelClassification {
  const r = raw.trim();
  const lower = r.toLowerCase();
  let capability: ModelClassification["capability"] = "unknown";
  if (EMBEDDING.test(lower)) capability = "embedding";
  else if (REASONING.test(lower)) capability = "reasoning";
  else if (/dall-e|image|vision|gpt-image|flux/i.test(lower)) capability = "image";
  else if (/whisper|tts|audio|transcri/i.test(lower)) capability = "audio";
  else if (/rerank|rank/i.test(lower)) capability = "rerank";
  else if (lower.length > 2) capability = "chat";

  let costProfile: ModelClassification["costProfile"] = "unknown";
  if (EXPENSIVE.test(lower)) costProfile = "high";
  else if (CHEAP.test(lower)) costProfile = "low";
  else if (lower.length > 2) costProfile = "medium";

  const spectyraStrategyHints: string[] = [];
  if (capability === "embedding") {
    spectyraStrategyHints.push("Embedding workload: consider batching and caching vectors.");
  }
  if (costProfile === "high") {
    spectyraStrategyHints.push("Higher-cost model: consider routing low-stakes tasks to smaller models.");
  }
  if (capability === "reasoning") {
    spectyraStrategyHints.push("Reasoning model: gate usage and cache stable reasoning where safe.");
  }
  if (/stream/i.test(raw)) {
    spectyraStrategyHints.push("Streaming: preserve stream semantics when wrapping with Spectyra.");
  }

  let provider = "unknown";
  if (/^gpt-|o\d|^text-embedding-3|^davinci|^curie/i.test(lower)) provider = "openai";
  else if (/^claude|anthropic/i.test(lower)) provider = "anthropic";
  else if (/^gemini|^models\/gemini/i.test(lower)) provider = "gemini";
  else if (/llama|mixtral|mistral|command-r|groq/i.test(lower)) provider = "mixed-open-weights";

  return {
    raw: r,
    provider,
    family: lower.split(/[-_/]/)[0],
    capability,
    costProfile,
    spectyraStrategyHints,
  };
}

export function extractModelLiteralsFromText(text: string, max = 12): string[] {
  const out = new Set<string>();
  const patterns: RegExp[] = [
    /\bmodel:\s*["']([^"']{1,120})["']/gi,
    /\bmodelName:\s*["']([^"']{1,120})["']/gi,
    /\bmodel\s*=\s*["']([^"']{1,120})["']/gi,
    /\bdeployment(?:Id|Name)?:\s*["']([^"']{1,120})["']/gi,
    /\bMODEL_NAME\s*=\s*["']([^"']{1,120})["']/gi,
    /\bmodel\s*=\s*process\.env\.([A-Z0-9_]+)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(text)) !== null) {
      const v = m[1]?.trim();
      if (v && v.length < 200) out.add(v);
      if (out.size >= max) return [...out];
    }
  }
  return [...out];
}

/** Heuristic model routing hints for Doctor recommendations and risks. */
export function classifyModel(raw: string): ModelClassification {
  const value = raw.toLowerCase();

  const out: ModelClassification = {
    raw,
    provider: "unknown",
    capability: "unknown",
    costProfile: "unknown",
    spectyraStrategyHints: [],
  };

  if (value.includes("gpt") || /^o[134]\b/.test(value)) {
    out.provider = "openai";
    out.family = value.match(/^\s*o[134]/) ? "reasoning" : "gpt";
  } else if (value.includes("claude")) {
    out.provider = "anthropic";
    out.family = "claude";
  } else if (value.includes("gemini")) {
    out.provider = "gemini";
    out.family = "gemini";
  } else if (value.includes("llama")) {
    out.family = "llama";
  }

  if (value.includes("mistral") || value.includes("mixtral")) {
    out.provider = "mistral";
    out.family = value.includes("mixtral") ? "mixtral" : "mistral";
  }
  if (value.includes("command-r")) {
    out.provider = "cohere";
    out.family = "command-r";
  }
  if (value.includes("sonar")) {
    out.provider = "perplexity";
    out.family = "sonar";
  }

  if (value.includes("embedding") || value.includes("embed")) {
    out.capability = "embedding";
    out.spectyraStrategyHints.push("Use embedding cache and batching where possible.");
  } else if (value.includes("image")) {
    out.capability = "image";
  } else if (value.includes("tts") || value.includes("audio") || value.includes("transcrib")) {
    out.capability = "audio";
  } else if (/^o[134]\b/.test(value) || value.includes("reason")) {
    out.capability = "reasoning";
    out.costProfile = "high";
    out.spectyraStrategyHints.push(
      "Reasoning model detected. Add request gating, reuse, and cheaper-model routing for low-value tasks.",
    );
  } else if (value.length > 1) {
    out.capability = "chat";
  }

  if (value.includes("mini") || value.includes("haiku") || value.includes("flash") || value.includes("8b")) {
    out.costProfile = "low";
  } else if (value.includes("opus") || value.includes("sonnet") || value.includes("gpt-4") || value.includes("gpt-5")) {
    out.costProfile = out.costProfile === "unknown" ? "high" : out.costProfile;
  }

  if (value.includes("32k") || value.includes("128k") || value.includes("200k") || value.includes("1m")) {
    out.spectyraStrategyHints.push("Large-context model detected. Use context reuse, prompt delta, retrieval pruning, and cache-aware routing.");
  }

  return out;
}
