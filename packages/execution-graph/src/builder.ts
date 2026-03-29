/**
 * Build execution graphs from normalized events or explicit step records.
 * Does not interpret vendor payloads — only SpectyraEvent.type and generic payload keys.
 */

import type { SpectyraEvent } from "@spectyra/event-core";
import type { ExecutionEdge, ExecutionGraph, ExecutionNode, ExecutionNodeKind } from "./types.js";
import { nextEdgeId } from "./types.js";

export type ManualStepRecord = {
  stepId: string;
  sessionId?: string;
  runId?: string;
  /** Creates step + optional request/response nodes. */
  inputTokens?: number;
  outputTokens?: number;
  transforms?: string[];
  success?: boolean;
  latencyMs?: number;
  /** If set, adds a repeats edge from this step to priorStepId. */
  repeatsPriorStepId?: string;
  toolCallIds?: string[];
};

function addNode(g: ExecutionGraph, n: ExecutionNode): void {
  g.nodes.set(n.id, n);
}

function addEdge(g: ExecutionGraph, kind: ExecutionEdge["kind"], fromId: string, toId: string, meta?: Record<string, unknown>): void {
  g.edges.push({
    id: nextEdgeId(),
    kind,
    fromId,
    toId,
    metadata: meta,
  });
}

/**
 * Incremental graph from a stream of SpectyraEvent (same shape companion/SDK emit).
 */
export function appendSpectyraEvent(graph: ExecutionGraph, event: SpectyraEvent): void {
  const sid = event.sessionId || "session";
  const rid = event.runId || "run";
  const stepKey = event.stepId || rid;

  switch (event.type) {
    case "session_started": {
      const nid = `checkpoint_${rid}_start`;
      addNode(graph, {
        id: nid,
        kind: "state_checkpoint",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
        labels: { phase: "session_start" },
      });
      break;
    }
    case "step_started": {
      const stepNode = `step_${stepKey}`;
      if (!graph.nodes.has(stepNode)) {
        addNode(graph, {
          id: stepNode,
          kind: "step",
          stepId: stepKey,
          sessionId: sid,
          runId: rid,
          timestamp: event.timestamp,
        });
        if (!graph.stepOrder.includes(stepKey)) graph.stepOrder.push(stepKey);
      }
      const reqId = `request_${stepKey}`;
      addNode(graph, {
        id: reqId,
        kind: "request",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
      });
      // Step execution depends on its request being formed.
      addEdge(graph, "depends_on", stepNode, reqId);
      break;
    }
    case "tool_called": {
      const tid = `tool_${event.stepId || stepKey}_${event.id.slice(0, 8)}`;
      addNode(graph, {
        id: tid,
        kind: "tool_call",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
      });
      addEdge(graph, "derived_from", tid, `step_${stepKey}`);
      break;
    }
    case "tool_result": {
      const trId = `toolres_${event.stepId || stepKey}_${event.id.slice(0, 8)}`;
      addNode(graph, {
        id: trId,
        kind: "tool_result",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
      });
      break;
    }
    case "optimization_applied":
    case "optimization_simulated": {
      const nid = `bundle_${stepKey}`;
      const p = event.payload;
      const tr = Array.isArray(p["transformsApplied"]) ? (p["transformsApplied"] as string[]).length : 0;
      addNode(graph, {
        id: nid,
        kind: "context_bundle",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
        metrics: {
          inputTokens: num(p, "inputTokensBefore", "estimatedInputTokensBefore"),
          outputTokens: num(p, "inputTokensAfter", "estimatedInputTokensAfter"),
          transformCount: tr,
        },
      });
      const stepNode = `step_${stepKey}`;
      if (graph.nodes.has(stepNode)) {
        addEdge(graph, "derived_from", nid, stepNode);
      } else {
        addNode(graph, {
          id: stepNode,
          kind: "step",
          stepId: stepKey,
          sessionId: sid,
          runId: rid,
          timestamp: event.timestamp,
        });
        if (!graph.stepOrder.includes(stepKey)) graph.stepOrder.push(stepKey);
        addEdge(graph, "derived_from", nid, stepNode);
      }
      break;
    }
    case "provider_request_completed": {
      const p = event.payload;
      const respId = `response_${stepKey}`;
      addNode(graph, {
        id: respId,
        kind: "response",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
        metrics: {
          inputTokens: num(p, "inputTokens", "promptTokens"),
          outputTokens: num(p, "outputTokens", "completionTokens"),
          success: p["success"] !== false,
          latencyMs: num(p, "latencyMs", "latency_ms"),
        },
      });
      const stepNode = `step_${stepKey}`;
      if (!graph.nodes.has(stepNode)) {
        addNode(graph, {
          id: stepNode,
          kind: "step",
          stepId: stepKey,
          sessionId: sid,
          runId: rid,
          timestamp: event.timestamp,
        });
        if (!graph.stepOrder.includes(stepKey)) graph.stepOrder.push(stepKey);
      }
      addEdge(graph, "depends_on", respId, stepNode);
      const bundleId = `bundle_${stepKey}`;
      if (graph.nodes.has(bundleId)) {
        addEdge(graph, "derived_from", respId, bundleId);
      }
      break;
    }
    case "session_finished": {
      addNode(graph, {
        id: `checkpoint_${rid}_end`,
        kind: "state_checkpoint",
        stepId: stepKey,
        sessionId: sid,
        runId: rid,
        timestamp: event.timestamp,
        labels: { phase: "session_end" },
      });
      break;
    }
    default:
      break;
  }
}

function num(p: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

export function createEmptyExecutionGraph(): ExecutionGraph {
  return { nodes: new Map(), edges: [], stepOrder: [] };
}

export function buildExecutionGraphFromSpectyraEvents(events: SpectyraEvent[]): ExecutionGraph {
  const g = createEmptyExecutionGraph();
  for (const e of events) appendSpectyraEvent(g, e);
  linkSequentialSteps(g);
  return g;
}

/** Add depends_on edges between consecutive steps in stepOrder (workflow path). */
export function linkSequentialSteps(g: ExecutionGraph): void {
  const order = g.stepOrder;
  for (let i = 1; i < order.length; i++) {
    const prev = `step_${order[i - 1]}`;
    const cur = `step_${order[i]}`;
    if (g.nodes.has(prev) && g.nodes.has(cur)) {
      const exists = g.edges.some((e) => e.fromId === cur && e.toId === prev && e.kind === "depends_on");
      if (!exists) addEdge(g, "depends_on", cur, prev);
    }
  }
}

/**
 * Explicit builder for tests and hosts that already have step records (no event stream).
 */
export function buildExecutionGraphFromManualSteps(steps: ManualStepRecord[]): ExecutionGraph {
  const g = createEmptyExecutionGraph();
  let priorStepId: string | undefined;
  for (const s of steps) {
    const stepNode = `step_${s.stepId}`;
    if (!g.nodes.has(stepNode)) {
      addNode(g, {
        id: stepNode,
        kind: "step",
        stepId: s.stepId,
        sessionId: s.sessionId,
        runId: s.runId,
        metrics: {
          inputTokens: s.inputTokens,
          outputTokens: s.outputTokens,
          transformCount: s.transforms?.length,
          success: s.success,
          latencyMs: s.latencyMs,
        },
      });
      g.stepOrder.push(s.stepId);
    }
    if (s.repeatsPriorStepId) {
      addEdge(g, "repeats", stepNode, `step_${s.repeatsPriorStepId}`, { reason: "declared_repeat" });
    }
    if (priorStepId && priorStepId !== s.stepId) {
      const prev = `step_${priorStepId}`;
      if (g.nodes.has(prev)) addEdge(g, "depends_on", stepNode, prev);
    }
    priorStepId = s.stepId;
    for (const tc of s.toolCallIds ?? []) {
      const tid = `tool_${s.stepId}_${tc}`;
      addNode(g, { id: tid, kind: "tool_call", stepId: s.stepId, sessionId: s.sessionId, runId: s.runId });
      addEdge(g, "derived_from", tid, stepNode);
    }
  }
  return g;
}
