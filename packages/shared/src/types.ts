export type Path = "talk" | "code";
export type Mode = "baseline" | "optimized";
export type Provider = "openai" | "anthropic" | "gemini" | "grok";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SemanticUnit {
  id: string;
  kind: "fact" | "constraint" | "explanation" | "code" | "patch";
  text: string;
  embedding?: number[];
  stabilityScore: number;
  createdAtTurn: number;
}

export interface ConversationState {
  conversationId: string;
  path: Path;
  units: SemanticUnit[];
  lastTurn: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated?: boolean;
}

export interface SpectralDebug {
  nNodes: number;
  nEdges: number;
  stabilityIndex: number;
  contradictionEnergy?: number;
  lambda2?: number;
  stableUnitIds: string[];
  unstableUnitIds: string[];
  recommendation: "REUSE" | "EXPAND" | "ASK_CLARIFY" | "STOP_EARLY";
}

export interface RunDebug {
  refsUsed?: string[];
  deltaUsed?: boolean;
  codeSliced?: boolean;
  patchMode?: boolean;
  spectral?: SpectralDebug;
  retry?: boolean;
}

export interface QualityCheck {
  pass: boolean;
  failures: string[];
}

export interface Savings {
  tokensSaved: number;
  pctSaved: number;
  costSavedUsd: number;
}

export interface RunRecord {
  id: string;
  scenarioId?: string;
  conversationId?: string;
  mode: Mode;
  path: Path;
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
