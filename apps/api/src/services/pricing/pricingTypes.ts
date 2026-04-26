/** Shared with SDK / Rust — normalized pricing snapshot (camelCase JSON). */

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
