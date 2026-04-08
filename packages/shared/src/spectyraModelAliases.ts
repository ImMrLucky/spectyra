/**
 * Stable Spectyra-local model aliases for OpenClaw and other OpenAI-compatible clients.
 *
 * - `spectyra/<smart|fast|quality>` — uses the user's default `provider` + alias models.
 * - `spectyra/<openai|anthropic|groq>/<smart|fast|quality>` — pins upstream vendor for that
 *   call (multi-vendor workflows: e.g. Anthropic for code, OpenAI for research).
 */

export type UpstreamProviderId = "openai" | "anthropic" | "groq";

export type SpectyraTier = "smart" | "fast" | "quality";

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
  /**
   * Optional tier overrides per upstream vendor for explicit routes
   * `spectyra/<openai|anthropic|groq>/<smart|fast|quality>`.
   * Omitted tiers use {@link defaultAliasModels} for that vendor.
   */
  providerTierModels?: Partial<Record<UpstreamProviderId, Partial<Record<SpectyraTier, string>>>>;
}

function isSpectyraTier(s: string): s is SpectyraTier {
  return s === "smart" || s === "fast" || s === "quality";
}

function isUpstreamProviderId(s: string): s is UpstreamProviderId {
  return s === "openai" || s === "anthropic" || s === "groq";
}

function tierUpstreamForExplicit(
  upstream: UpstreamProviderId,
  tier: SpectyraTier,
  cfg: ResolveSpectyraModelInput,
): string {
  const defaults = defaultAliasModels(upstream);
  const override = cfg.providerTierModels?.[upstream]?.[tier];
  return override ?? defaults[tier];
}

const SPECTYRA_ALIAS_HINT =
  "Use spectyra/<smart|fast|quality> or spectyra/<openai|anthropic|groq>/<smart|fast|quality>.";

/**
 * OpenClaw / companion model catalog entries (IDs and display metadata).
 */
export function spectyraOpenClawModelDefinitions(): Array<{
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}> {
  const tierWindow = (quality: boolean) =>
    quality
      ? { contextWindow: 200_000, maxTokens: 16_384 }
      : { contextWindow: 128_000, maxTokens: 8192 };

  const legacy: Array<{ id: string; name: string; quality: boolean }> = [
    { id: "spectyra/smart", name: "Spectyra Smart", quality: false },
    { id: "spectyra/fast", name: "Spectyra Fast", quality: false },
    { id: "spectyra/quality", name: "Spectyra Quality", quality: true },
  ];

  const out: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }> = legacy.map(
    (row) => ({
      id: row.id,
      name: row.name,
      ...tierWindow(row.quality),
    }),
  );

  const labels: Record<UpstreamProviderId, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    groq: "Groq",
  };

  for (const p of (["openai", "anthropic", "groq"] as const)) {
    for (const tier of (["smart", "fast", "quality"] as const)) {
      const quality = tier === "quality";
      out.push({
        id: `spectyra/${p}/${tier}`,
        name: `Spectyra · ${labels[p]} · ${tier}`,
        ...tierWindow(quality),
      });
    }
  }

  return out;
}

/**
 * Maps a request model id to upstream provider + real model id.
 * `spectyra/smart` → user's chosen provider + configured alias models.
 * `spectyra/anthropic/quality` → Anthropic + tier resolution (overrides + defaults).
 */
export function resolveSpectyraModel(
  model: string,
  cfg: ResolveSpectyraModelInput,
): { requestedModel: string; upstreamModel: string; provider: UpstreamProviderId } {
  let m = model.trim();
  // OpenClaw (and similar clients) use a provider-scoped base URL and send bare `smart` / `fast` /
  // `quality` instead of `spectyra/smart`. Map those to our stable alias namespace.
  if (m === "smart" || m === "fast" || m === "quality") {
    m = `spectyra/${m}`;
  }
  if (m.startsWith("spectyra/")) {
    const rest = m.slice("spectyra/".length);
    const segments = rest.split("/").filter(Boolean);

    if (segments.length === 1) {
      const alias = segments[0];
      if (!isSpectyraTier(alias)) {
        throw new Error(`Unknown Spectyra model alias: spectyra/${rest}. ${SPECTYRA_ALIAS_HINT}`);
      }
      const upstreamModel =
        alias === "smart"
          ? cfg.aliasSmartModel
          : alias === "fast"
            ? cfg.aliasFastModel
            : cfg.aliasQualityModel;
      const provider = cfg.provider as UpstreamProviderId;
      if (!isUpstreamProviderId(provider)) {
        throw new Error(`Invalid provider: ${cfg.provider}`);
      }
      return { requestedModel: m, upstreamModel, provider };
    }

    if (segments.length === 2) {
      const [rawUp, rawTier] = segments;
      const up = rawUp.toLowerCase();
      const tier = rawTier.toLowerCase();
      if (!isUpstreamProviderId(up)) {
        throw new Error(
          `Unknown Spectyra upstream in model id: spectyra/${rest}. Expected openai, anthropic, or groq.`,
        );
      }
      if (!isSpectyraTier(tier)) {
        throw new Error(`Unknown Spectyra tier in model id: spectyra/${rest}. ${SPECTYRA_ALIAS_HINT}`);
      }
      const upstreamModel = tierUpstreamForExplicit(up, tier, cfg);
      return { requestedModel: m, upstreamModel, provider: up };
    }

    throw new Error(`Unknown Spectyra model alias: spectyra/${rest}. ${SPECTYRA_ALIAS_HINT}`);
  }
  const upstreamModel = m;
  const provider = inferProviderFromModelId(upstreamModel);
  return { requestedModel: m, upstreamModel, provider };
}
