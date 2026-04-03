/**
 * Stable Spectyra-local model aliases (spectyra/smart, spectyra/fast) for OpenClaw
 * and other OpenAI-compatible clients. Routing uses the user's selected provider
 * in Desktop / companion config — not OpenClaw-specific logic in the optimizer.
 */

export type UpstreamProviderId = "openai" | "anthropic" | "groq";

export function defaultAliasModels(provider: string): { smart: string; fast: string; quality: string } {
  switch (provider) {
    case "anthropic":
      return {
        smart: "claude-3-5-sonnet-20241022",
        fast: "claude-3-5-haiku-20241022",
        quality: "claude-3-5-sonnet-20241022",
      };
    case "groq":
      return {
        smart: "llama-3.1-70b-versatile",
        fast: "llama-3.1-8b-instant",
        quality: "llama-3.1-70b-versatile",
      };
    default:
      return { smart: "gpt-4o-mini", fast: "gpt-4o-mini", quality: "gpt-4o" };
  }
}

export function inferProviderFromModelId(model: string): UpstreamProviderId {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "anthropic";
  if (m.includes("llama") || m.includes("mixtral") || m.includes("gemma")) return "groq";
  return "openai";
}

export interface ResolveSpectyraModelInput {
  provider: string;
  aliasSmartModel: string;
  aliasFastModel: string;
  /** Maps `spectyra/quality` — higher-latency / higher-capability upstream default per provider. */
  aliasQualityModel: string;
}

/**
 * Maps a request model id to upstream provider + real model id.
 * `spectyra/smart` and `spectyra/fast` → user's chosen provider + configured alias models.
 */
export function resolveSpectyraModel(
  model: string,
  cfg: ResolveSpectyraModelInput,
): { requestedModel: string; upstreamModel: string; provider: UpstreamProviderId } {
  const m = model.trim();
  if (m.startsWith("spectyra/")) {
    const alias = m.slice("spectyra/".length);
    if (alias !== "smart" && alias !== "fast" && alias !== "quality") {
      throw new Error(
        `Unknown Spectyra model alias: spectyra/${alias}. Use spectyra/smart, spectyra/fast, or spectyra/quality.`,
      );
    }
    const upstreamModel =
      alias === "smart"
        ? cfg.aliasSmartModel
        : alias === "fast"
          ? cfg.aliasFastModel
          : cfg.aliasQualityModel;
    const provider = cfg.provider as UpstreamProviderId;
    if (provider !== "openai" && provider !== "anthropic" && provider !== "groq") {
      throw new Error(`Invalid provider: ${cfg.provider}`);
    }
    return { requestedModel: m, upstreamModel, provider };
  }
  const upstreamModel = m;
  const provider = inferProviderFromModelId(upstreamModel);
  return { requestedModel: m, upstreamModel, provider };
}
