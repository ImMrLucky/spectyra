/**
 * Versioned pricing snapshot served to SDK / runtimes until a DB-backed registry ships.
 * Normalized shape matches `ProviderPricingSnapshot` in Spectyra docs / Rust core.
 */

import type { ProviderPricingSnapshot } from "./pricingTypes.js";

export type { ProviderPricingSnapshot } from "./pricingTypes.js";

const SNAPSHOT_VERSION = "bundled-2026-04-01";

/** ISO-ish timestamp for snapshot metadata */
function createdAt(): string {
  return new Date().toISOString();
}

/**
 * Conservative USD per-1M-token style rows expressed as `per_1m_tokens` unit prices
 * in components (see `PricingComponent`).
 */
export function getBundledProviderPricingSnapshot(providerFilter?: string): ProviderPricingSnapshot {
  const entries = [
    {
      id: "openai:gpt-4o-mini:global",
      provider: "openai" as const,
      modelId: "gpt-4o-mini",
      displayName: "GPT-4o mini",
      endpointClass: "global" as const,
      region: null,
      sourceUrl: "https://openai.com/api/pricing/",
      sourceLabel: "OpenAI public pricing (approximate)",
      sourceFetchedAt: createdAt(),
      effectiveFrom: null,
      effectiveTo: null,
      batchDiscount: { supported: true, inputMultiplier: 0.5, outputMultiplier: 0.5, notes: "Batch API discount per OpenAI docs" },
      components: [
        { key: "input_tokens" as const, label: "Input", price: 0.15, unit: "per_1m_tokens" as const, currency: "USD" as const },
        { key: "output_tokens" as const, label: "Output", price: 0.6, unit: "per_1m_tokens" as const, currency: "USD" as const },
      ],
      metadata: { includesThinkingInOutput: false, tokenizerNotes: undefined, contextCachingSupported: true, pricingNotes: [] },
    },
    {
      id: "openai:gpt-4o:global",
      provider: "openai" as const,
      modelId: "gpt-4o",
      displayName: "GPT-4o",
      endpointClass: "global" as const,
      region: null,
      sourceUrl: "https://openai.com/api/pricing/",
      sourceLabel: "OpenAI public pricing (approximate)",
      sourceFetchedAt: createdAt(),
      effectiveFrom: null,
      effectiveTo: null,
      batchDiscount: { supported: true, inputMultiplier: 0.5, outputMultiplier: 0.5 },
      components: [
        { key: "input_tokens" as const, label: "Input", price: 2.5, unit: "per_1m_tokens" as const, currency: "USD" as const },
        { key: "output_tokens" as const, label: "Output", price: 10, unit: "per_1m_tokens" as const, currency: "USD" as const },
      ],
      metadata: { includesThinkingInOutput: false, contextCachingSupported: true, pricingNotes: [] },
    },
    {
      id: "anthropic:claude-3-5-sonnet:global",
      provider: "anthropic" as const,
      modelId: "claude-3-5-sonnet-20241022",
      displayName: "Claude 3.5 Sonnet",
      endpointClass: "global" as const,
      region: null,
      sourceUrl: "https://www.anthropic.com/pricing",
      sourceLabel: "Anthropic public pricing (approximate)",
      sourceFetchedAt: createdAt(),
      effectiveFrom: null,
      effectiveTo: null,
      components: [
        { key: "input_tokens" as const, label: "Input", price: 3, unit: "per_1m_tokens" as const, currency: "USD" as const },
        { key: "output_tokens" as const, label: "Output", price: 15, unit: "per_1m_tokens" as const, currency: "USD" as const },
      ],
      metadata: { includesThinkingInOutput: false, contextCachingSupported: true, pricingNotes: [] },
    },
  ];

  const filtered =
    providerFilter?.trim() ?
      entries.filter(e => e.provider === providerFilter.trim().toLowerCase())
    : entries;

  return {
    version: SNAPSHOT_VERSION,
    createdAt: createdAt(),
    currency: "USD",
    ttlSeconds: 86_400,
    entries: filtered,
  };
}
