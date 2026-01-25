export interface Scenario {
  id: string;
  path: 'talk' | 'code';
  title: string;
  turns?: Array<{ role: 'user' | 'assistant'; content: string }>;
  required_checks?: Array<{ name: string; type: string; pattern: string }>;
}

export interface Provider {
  name: string;
  models: string[];
  supportsUsage: boolean;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated?: boolean;
}

export interface Savings {
  tokensSaved: number;
  pctSaved: number;
  costSavedUsd: number;
}

export interface QualityCheck {
  pass: boolean;
  failures: string[];
}

export interface SpectralDebug {
  nNodes: number;
  nEdges: number;
  stabilityIndex: number;
  lambda2?: number;
  contradictionEnergy?: number;
  stableUnitIds: string[];
  unstableUnitIds: string[];
  recommendation: 'REUSE' | 'EXPAND' | 'ASK_CLARIFY' | 'STOP_EARLY';
}

export interface RunDebug {
  refsUsed?: string[];
  deltaUsed?: boolean;
  codeSliced?: boolean;
  patchMode?: boolean;
  spectral?: SpectralDebug;
  retry?: boolean;
  retry_reason?: string;
  first_failures?: string[];
}

export interface RunRecord {
  id: string;
  scenarioId?: string;
  conversationId?: string;
  mode: 'baseline' | 'optimized';
  path: 'talk' | 'code';
  provider: string;
  model: string;
  promptFinal: any;
  responseText: string;
  usage: Usage;
  costUsd: number;
  savings?: Savings;
  quality: QualityCheck;
  debug: RunDebug;
  createdAt: string;
}

export interface ReplayResult {
  scenario_id: string;
  baseline: RunRecord;
  optimized: RunRecord;
  savings: Savings;
  quality: {
    baseline_pass: boolean;
    optimized_pass: boolean;
  };
}
