/**
 * Read / tool-output lifecycle classifications (analytics; pairs with event spine).
 */

import type { ExecutionGraph } from "./types.js";

export type ReadLifecycleClass = "fresh" | "reused" | "stale" | "superseded" | "compressible";

export interface ToolOutputHandle {
  id: string;
  firstSeenStepId: string;
  lastReferencedStepId?: string;
  /** Rough size for “expensive to resend” heuristics. */
  estimatedChars?: number;
  supersededById?: string;
}

export function classifyToolOutputLifecycle(
  handle: ToolOutputHandle,
  graph: ExecutionGraph,
): { classification: ReadLifecycleClass; reasons: string[] } {
  const reasons: string[] = [];
  let classification: ReadLifecycleClass = "fresh";

  if (handle.supersededById) {
    return { classification: "superseded", reasons: ["explicit_superseded_ref"] };
  }

  const last = handle.lastReferencedStepId;
  const first = handle.firstSeenStepId;
  if (last && first && last !== first) {
    classification = "reused";
    reasons.push("referenced_across_steps");
  }

  const order = graph.stepOrder;
  const fi = order.indexOf(first);
  const li = last ? order.indexOf(last) : -1;
  if (fi >= 0 && li > fi + 2) {
    reasons.push("late_reuse");
    if (classification === "reused") classification = "stale";
  }

  if ((handle.estimatedChars ?? 0) > 20_000 && classification === "reused") {
    reasons.push("large_payload");
    classification = "compressible";
  }

  if (reasons.length === 0) reasons.push("default_fresh");
  return { classification, reasons };
}

/** True if an edge marks low_value_path between two step nodes. */
export function hasLowValuePathBetween(g: ExecutionGraph, stepIdA: string, stepIdB: string): boolean {
  const a = `step_${stepIdA}`;
  const b = `step_${stepIdB}`;
  return g.edges.some(
    (e) =>
      e.kind === "low_value_path" &&
      ((e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a)),
  );
}
