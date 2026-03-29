/**
 * Execution graph — workflow structure distinct from optimizer semantic-unit graphs
 * (RefPack / spectral SCC live in @spectyra/optimizer-algorithms).
 */

export type ExecutionNodeKind =
  | "step"
  | "request"
  | "tool_call"
  | "tool_result"
  | "state_checkpoint"
  | "context_bundle"
  | "response";

export type ExecutionEdgeKind =
  | "depends_on"
  | "derived_from"
  | "reuses_context"
  | "repeats"
  | "supersedes"
  | "contradicts"
  | "low_value_path";

export interface ExecutionNodeMetrics {
  inputTokens?: number;
  outputTokens?: number;
  transformCount?: number;
  success?: boolean;
  latencyMs?: number;
}

/** A node in the workflow execution DAG (or multi-graph). */
export interface ExecutionNode {
  id: string;
  kind: ExecutionNodeKind;
  /** Logical step key (groups request/tool/response for one hop). */
  stepId?: string;
  sessionId?: string;
  runId?: string;
  timestamp?: string;
  metrics?: ExecutionNodeMetrics;
  /** Opaque hints for UI / policies — never required for core logic. */
  labels?: Record<string, string | number | boolean>;
}

export interface ExecutionEdge {
  id: string;
  kind: ExecutionEdgeKind;
  fromId: string;
  toId: string;
  /** Optional strength (e.g. similarity, cost). */
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionGraph {
  nodes: Map<string, ExecutionNode>;
  edges: ExecutionEdge[];
  /** Step ids in first-seen order. */
  stepOrder: string[];
}

let _edgeSeq = 0;
export function nextEdgeId(): string {
  return `e_${++_edgeSeq}_${Date.now().toString(36)}`;
}
