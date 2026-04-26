/**
 * Normalized pricing types (aligned with `GET /v1/pricing/snapshot` and Rust `spectyra_core`).
 * @public
 */

export type CurrencyCode = "USD";

export type PricingUnit =
  | "per_1m_tokens"
  | "per_1k_calls"
  | "per_request"
  | "per_hour"
  | "per_minute"
  | "per_image";

export type ProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "mistral"
  | "groq"
  | "openrouter"
  | "custom";

export type EndpointClass = "global" | "regional" | "multi_region" | "first_party" | "third_party";

export interface PricingComponent {
  key: string;
  label: string;
  price: number;
  unit: PricingUnit;
  currency: CurrencyCode;
  included?: boolean;
  notes?: string;
}

export interface ModelPricingEntry {
  id: string;
  provider: ProviderName;
  modelId: string;
  displayName: string;
  endpointClass: EndpointClass;
  region?: string | null;
  sourceUrl: string;
  sourceLabel: string;
  sourceFetchedAt: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  batchDiscount?: {
    supported: boolean;
    inputMultiplier?: number;
    outputMultiplier?: number;
    notes?: string;
  };
  components: PricingComponent[];
  metadata?: {
    includesThinkingInOutput?: boolean;
    tokenizerNotes?: string;
    contextCachingSupported?: boolean;
    pricingNotes?: string[];
  };
}

export interface ProviderPricingSnapshot {
  version: string;
  createdAt: string;
  currency: CurrencyCode;
  ttlSeconds: number;
  entries: ModelPricingEntry[];
}

export interface CostBreakdownLine {
  componentKey: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface CostBreakdown {
  provider: string;
  modelId: string;
  pricingEntryId: string | null;
  source: "provider_usage_plus_registry" | "registry_only" | "manual_override" | "fallback_estimate";
  currency: CurrencyCode;
  lines: CostBreakdownLine[];
  total: number;
  warnings: string[];
}

export interface SavingsCalculation {
  baseline: CostBreakdown;
  optimized: CostBreakdown;
  savingsAmount: number;
  savingsPercent: number;
}

/** Token / usage slice for registry cost lines (no prompts). */
export interface NormalizedUsage {
  provider: string;
  modelId: string;
  endpointClass?: string;
  region?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  thinkingTokens?: number;
  reasoningTokens?: number;
  toolCalls?: number;
  webSearchCalls?: number;
  groundedPrompts?: number;
  imageInputs?: number;
  imageOutputs?: number;
  audioInputTokens?: number;
  audioOutputTokens?: number;
  storageHours?: number;
  batch?: boolean;
  rawProviderUsage?: unknown;
  /**
   * When set, forces `CostBreakdown.source` regardless of `rawProviderUsage`.
   * `fallback_estimate` is also used when the registry entry cannot price billable usage (see calculator).
   */
  costSourceOverride?: "manual_override" | "fallback_estimate";
}
