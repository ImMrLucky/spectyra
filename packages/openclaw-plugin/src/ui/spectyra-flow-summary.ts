import type { CompanionClient } from "../companion/companion-client.js";
import { flowJsonToSummary } from "../companion/companion-client.js";
import type { SpectyraFlowSummary } from "../companion/companion-types.js";

export interface FlowSummaryDescriptor {
  kind: "spectyra.flow_summary";
  summary: SpectyraFlowSummary;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Prefer seamless `flows/latest`, then explicit `GET .../flows/:id` when flowId known.
 */
export async function resolveFlowSummary(
  client: CompanionClient,
  flowId: string | undefined,
): Promise<SpectyraFlowSummary | null> {
  if (flowId) {
    const json = await client.getFlow(flowId);
    if (json) {
      const s = flowJsonToSummary(flowId, json);
      if (s) {
        return s;
      }
    }
  }

  const latest = await client.getOpenClawFlowsLatest();
  if (isRecord(latest) && latest.ok === true) {
    const fid = typeof latest.flowId === "string" ? latest.flowId : flowId ?? "flow";
    const s = flowJsonToSummary(fid, latest);
    if (s) {
      return s;
    }
  }

  return null;
}

export function buildFlowSummaryDescriptor(summary: SpectyraFlowSummary): FlowSummaryDescriptor {
  return { kind: "spectyra.flow_summary", summary };
}

export function formatFlowSummarySpectyraBlock(summary: SpectyraFlowSummary): string {
  const lines = ["## ⚡ Spectyra Flow Savings"];
  if (summary.percentSaved !== undefined) {
    lines.push(`**Saved:** ${summary.percentSaved.toFixed(0)}%`);
  }
  if (summary.stepsOptimized !== undefined && summary.totalSteps !== undefined) {
    lines.push(`**Steps Optimized:** ${summary.stepsOptimized}/${summary.totalSteps}`);
  }
  if (summary.estimatedCostSaved !== undefined) {
    lines.push(`**Cost Saved:** $${summary.estimatedCostSaved.toFixed(2)}`);
  }
  return lines.join("\n");
}

export function formatFlowSummaryLines(summary: SpectyraFlowSummary): string[] {
  const lines: string[] = [];
  if (summary.percentSaved !== undefined) {
    lines.push(`Estimated savings: ${summary.percentSaved.toFixed(1)}%`);
  }
  if (summary.estimatedCostSaved !== undefined) {
    lines.push(`Estimated cost saved: ${summary.estimatedCostSaved.toFixed(4)}`);
  }
  if (summary.stepsOptimized !== undefined && summary.totalSteps !== undefined) {
    lines.push(`Steps optimized: ${summary.stepsOptimized} / ${summary.totalSteps}`);
  }
  if (summary.highestSavingStep) {
    lines.push(`Top step: ${summary.highestSavingStep.name} (${summary.highestSavingStep.percentSaved.toFixed(1)}%)`);
  }
  return lines;
}
