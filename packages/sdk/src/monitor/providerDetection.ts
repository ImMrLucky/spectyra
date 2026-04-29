import type { SpectyraMonitorProvider } from "./monitorTypes.js";

/**
 * Map request host to provider id (extensible; unknown → "unknown").
 * @public
 */
export function detectProviderFromHost(host: string): SpectyraMonitorProvider {
  const h = host.trim().toLowerCase();
  if (!h) return "unknown";

  if (h === "api.openai.com" || h.endsWith(".openai.com")) return "openai";
  if (h.includes("openai.azure.com")) return "azure-openai";
  if (h === "api.anthropic.com" || h.endsWith(".anthropic.com")) return "anthropic";
  if (h === "generativelanguage.googleapis.com" || h.includes("googleapis.com")) return "google-gemini";
  if (h === "api.groq.com" || h.endsWith(".groq.com")) return "groq";
  if (h.includes("bedrock-runtime") && h.includes("amazonaws.com")) return "aws-bedrock";
  if (h === "api.mistral.ai") return "mistral";
  if (h === "api.cohere.ai" || h.endsWith(".cohere.ai")) return "cohere";
  if (h === "openrouter.ai" || h.endsWith(".openrouter.ai")) return "openrouter";
  if (h === "api.together.xyz" || h.endsWith(".together.xyz")) return "together";
  if (h === "api.perplexity.ai" || h.endsWith(".perplexity.ai")) return "perplexity";

  return "unknown";
}

/**
 * Map SDK `complete()` provider string to monitor enum.
 * @public
 */
export function normalizeMonitorProvider(vendor: string): SpectyraMonitorProvider {
  const p = vendor.trim().toLowerCase();
  if (!p) return "unknown";
  if (p === "openai") return "openai";
  if (p === "anthropic") return "anthropic";
  if (p === "groq") return "groq";
  if (p.includes("azure")) return "azure-openai";
  if (p.includes("bedrock") || p === "aws-bedrock") return "aws-bedrock";
  if (p.includes("gemini") || p === "google" || p.includes("generativelanguage")) return "google-gemini";
  if (p === "mistral" || p.includes("mistral")) return "mistral";
  if (p === "cohere" || p.includes("cohere")) return "cohere";
  if (p.includes("openrouter")) return "openrouter";
  if (p.includes("together")) return "together";
  if (p.includes("perplexity")) return "perplexity";
  return "unknown";
}
