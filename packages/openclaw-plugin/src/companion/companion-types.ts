export interface CompanionHealth {
  status?: string;
  service?: string;
  runMode?: string;
  optimizationRunMode?: string;
  savingsEnabled?: boolean;
  companionReady?: boolean;
  openclawFreeMode?: boolean;
  packageVersion?: string;
}

export interface SpectyraFlowSummary {
  flowId: string;
  totalInputTokensBefore?: number;
  totalInputTokensAfter?: number;
  totalOutputTokensBefore?: number;
  totalOutputTokensAfter?: number;
  estimatedCostBefore?: number;
  estimatedCostAfter?: number;
  estimatedCostSaved?: number;
  percentSaved?: number;
  stepsOptimized?: number;
  totalSteps?: number;
  highestSavingStep?: {
    name: string;
    percentSaved: number;
  };
}

/** Savings shown inline — only populated from companion JSON, never invented. */
export interface SpectyraTraceSavingsView {
  traceId: string;
  percentSaved?: number;
  estimatedCostSaved?: number;
  currency?: string;
  inputTokensBefore?: number;
  inputTokensAfter?: number;
  outputTokensBefore?: number;
  outputTokensAfter?: number;
  raw?: Record<string, unknown>;
}

export interface CompanionConnectionState {
  reachable: boolean;
  health: CompanionHealth | null;
  lastErrorClass?: string;
}

/** Companion `GET /openclaw/v1/latest` success body — already computed server-side. */
export interface OpenClawLatestOk {
  ok: true;
  traceId: string;
  flowId: string;
  timestamp: string;
  model: string;
  percentSaved: number;
  estimatedCostBefore: number;
  estimatedCostAfter: number;
  estimatedCostSaved: number;
  inputTokensBefore: number;
  inputTokensAfter: number;
  outputTokensBefore: number;
  outputTokensAfter: number;
  transformsApplied: string[];
}

export type OpenClawLatestResponse = OpenClawLatestOk | { ok: false; reason: string };

