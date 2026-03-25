export type StudioScenarioId =
  | "token_chat"
  | "token_code"
  | "agent_claude"
  | "openclaw_local"
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

/**
 * Spectral / flow intelligence for the optimized path (same engine as Desktop/SDK).
 * Computed from the message graph in-process — does not require OpenClaw, apps, or live provider calls.
 */
export interface StudioFlowSummary {
  recommendation: "REUSE" | "EXPAND" | "ASK_CLARIFY";
  /** Context stability [0, 1]. */
  stabilityIndex: number;
  /** Algebraic connectivity (Fiedler). */
  lambda2: number;
  /** Contradiction mass in the semantic graph [0, 1]. */
  contradictionEnergy: number;
  nNodes?: number;
  nEdges?: number;
}

export interface StudioRunResult {
  runId: string;
  createdAt: string;
  raw: StudioRunSide;
  spectyra: StudioRunSide;
  metrics: StudioRunMetrics;
  appliedTransforms?: string[];
  /**
   * Flow signals from spectral analysis on the Spectyra-optimized prompt (dry-run or live).
   * Present when the optimizer produced a spectral result — independent of token rows above.
   */
  flowSummary?: StudioFlowSummary;
  meta?: {
    estimated: boolean;
    reverted?: boolean;
  };
}

