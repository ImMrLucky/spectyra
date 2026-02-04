export type StudioScenarioId =
  | "token_chat"
  | "token_code"
  | "agent_claude"
  | "langchain_rag"
  | "multi_agent_loop"
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
  /** The prompt/messages that would be sent to the model (rendered). */
  promptText: string;
  /** Model output text (only present for live provider runs). */
  modelOutputText?: string;
  toolCalls?: Array<{ tool: string; args: any; resultPreview?: string }>;
  toolSignals?: { run_terminal_cmd: number; read_file: number; apply_patch: number };
  tokens: { input: number; output: number; total: number };
  latencyMs: number;
  costUsd?: number;
  violations?: Array<{ code: string; message: string }>;
}

export interface StudioRunMetrics {
  /** Input token savings (prompt tokens). */
  tokenSavingsPct?: number;
  inputTokensSaved?: number;
  totalTokensSaved?: number;
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
  appliedTransforms?: string[];
  meta?: {
    estimated: boolean;
    reverted?: boolean;
  };
}

