export type StudioScenarioId =
  | "token_chat"
  | "token_code"
  | "agent_claude"
  | "chatbot_governance"
  | "supportbot"
  | "coding_compliance";

export interface StudioRunRequest {
  scenarioId: StudioScenarioId;
  inputs: {
    primary: string;
    secondary?: string;
    advanced?: Record<string, any>;
  };
  mode: "raw_vs_spectyra";
}

export interface StudioRunSide {
  outputText: string;
  toolCalls?: Array<{ tool: string; args: any; resultPreview?: string }>;
  tokens: { input: number; output: number; total: number };
  latencyMs: number;
  costUsd?: number;
  violations?: Array<{ code: string; message: string }>;
}

export interface StudioRunMetrics {
  tokenSavingsPct?: number;
  costSavingsPct?: number;
  retriesAvoided?: number;
  violationsPrevented?: number;
  toolCallsReduced?: number;
}

export interface StudioRunResult {
  runId: string;
  createdAt: string;
  raw: StudioRunSide;
  spectyra: StudioRunSide;
  metrics: StudioRunMetrics;
}

