/**
 * Spectyra monitor event schema (metadata-only, fail-open).
 * @public
 */

export type SpectyraMonitorProvider =
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "groq"
  | "azure-openai"
  | "aws-bedrock"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "together"
  | "perplexity"
  | "unknown";

export type SpectyraMonitorIntegrationMode =
  | "explicit_sdk"
  | "auto_fetch"
  | "auto_http"
  | "auto_provider_sdk"
  | "framework_hook";

export type SpectyraMonitorPricingSource =
  | "provider_usage"
  | "local_token_estimate"
  | "size_approximation"
  | "manual"
  | "unknown";

export type SpectyraMonitorOptimizerStatus =
  | "enabled"
  | "disabled_config"
  | "disabled_quota"
  | "disabled_account"
  | "disabled_missing_key"
  | "not_integrated"
  | "unknown";

export interface SpectyraWasteSignal {
  type:
    | "repeated_call"
    | "cache_opportunity"
    | "retry_loop"
    | "agent_loop"
    | "tool_overuse"
    | "large_context"
    | "high_output_tokens"
    | "model_overkill"
    | "rag_overfetch"
    | "rate_limit_retries"
    | "slow_expensive_call";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  estimatedWasteUsd?: number;
  estimatedMonthlyImpactUsd?: number;
  confidence: "high" | "medium" | "low";
  groupKey?: string;
}

/**
 * Single monitor row — must remain metadata-only (no prompts, keys, raw bodies).
 */
export interface SpectyraMonitorEvent {
  eventId: string;
  timestamp: string;

  project?: string;
  environment?: string;
  service?: string;
  endpoint?: string;
  operationName?: string;
  workflowType?: string;
  agentName?: string;
  toolName?: string;
  tenantIdHash?: string;
  userIdHash?: string;
  traceId?: string;
  sessionId?: string;
  runId?: string;

  provider: SpectyraMonitorProvider;
  model?: string;
  modelFamily?: string;
  integrationMode: SpectyraMonitorIntegrationMode;
  sdkLanguage: "typescript" | "python";
  sdkVersion?: string;

  urlHost?: string;
  route?: string;
  method?: string;
  statusCode?: number;

  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  audioInputTokens?: number;
  audioOutputTokens?: number;

  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedTotalTokens?: number;

  contextWindowTokens?: number;
  contextWindowUtilizationPct?: number;

  inputCostUsd?: number;
  outputCostUsd?: number;
  cachedInputCostUsd?: number;
  reasoningCostUsd?: number;
  actualCostUsd?: number;
  estimatedCostUsd?: number;
  currency?: "USD";

  rawEstimatedCostUsd?: number;
  optimizedCostUsd?: number;
  savedUsd?: number;
  savingsPct?: number;

  projectedOptimizedCostUsd?: number;
  missedSavingsUsd?: number;
  missedSavingsPct?: number;
  missedSavingsConfidence?: "high" | "medium" | "low";
  missedSavingsSource?: "local_simulation" | "recent_average" | "default_baseline";

  optimizerEnabled?: boolean;
  optimizerApplied?: boolean;
  optimizerStatus?: SpectyraMonitorOptimizerStatus;

  latencyMs: number;
  timeToFirstTokenMs?: number;
  providerLatencyMs?: number;
  spectyraOverheadMs?: number;
  optimizerTimeMs?: number;
  tokenCountingTimeMs?: number;

  success: boolean;
  errorType?: string;
  errorCode?: string;
  retryCount?: number;
  timeout?: boolean;
  rateLimited?: boolean;

  finishReason?: string;
  promptLengthChars?: number;
  responseLengthChars?: number;
  messageCount?: number;
  toolCallCount?: number;
  functionCallCount?: number;
  retrievalChunkCount?: number;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  jsonMode?: boolean;
  toolsEnabled?: boolean;
  ragEnabled?: boolean;
  cacheHit?: boolean;
  cacheMiss?: boolean;
  fallbackModelUsed?: boolean;
  modelRerouted?: boolean;

  pricingSource: SpectyraMonitorPricingSource;
  pricingVersion?: string;
  pricingStale?: boolean;

  wasteSignals?: SpectyraWasteSignal[];

  metadataOnly: true;
}

export interface SpectyraMonitorSummary {
  requestCount: number;
  successCount: number;
  errorCount: number;
  actualSpendProviderUsd: number;
  optimizedSpendSpectyraUsd: number;
  savingsUsd: number;
  missedSavingsUsd: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageCostPerRequestUsd: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastRequestAt: string | null;
}
