/**
 * Prompt diff core.
 *
 * Computes structural diffs between original and optimized canonical requests.
 * Used to explain what transforms changed and where.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationPipelineResult,
} from "@spectyra/canonical-model";

export interface MessageDiff {
  index: number;
  role: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  beforePreview?: string;
  afterPreview?: string;
  charDelta: number;
}

export interface PromptDiffSummary {
  runId: string;
  totalMessagesBefore: number;
  totalMessagesAfter: number;
  messagesAdded: number;
  messagesRemoved: number;
  messagesModified: number;
  totalCharDelta: number;
  diffs: MessageDiff[];
  transformsApplied: string[];
}

const PREVIEW_LENGTH = 200;

function preview(msg: CanonicalMessage): string {
  const text = msg.text ?? "";
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH) + "…" : text;
}

/**
 * Compute a structural diff between original and optimized requests.
 */
export function computePromptDiff(pipeline: OptimizationPipelineResult): PromptDiffSummary {
  const before = pipeline.originalRequest.messages;
  const after = pipeline.optimizedRequest.messages;
  const diffs: MessageDiff[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  const maxLen = Math.max(before.length, after.length);
  for (let i = 0; i < maxLen; i++) {
    const b = before[i];
    const a = after[i];

    if (!b && a) {
      added++;
      diffs.push({
        index: i,
        role: a.role,
        changeType: "added",
        afterPreview: preview(a),
        charDelta: a.text?.length ?? 0,
      });
    } else if (b && !a) {
      removed++;
      diffs.push({
        index: i,
        role: b.role,
        changeType: "removed",
        beforePreview: preview(b),
        charDelta: -(b.text?.length ?? 0),
      });
    } else if (b && a) {
      const bText = b.text ?? "";
      const aText = a.text ?? "";
      if (bText === aText && b.role === a.role) {
        diffs.push({
          index: i,
          role: b.role,
          changeType: "unchanged",
          charDelta: 0,
        });
      } else {
        modified++;
        diffs.push({
          index: i,
          role: a.role,
          changeType: "modified",
          beforePreview: preview(b),
          afterPreview: preview(a),
          charDelta: aText.length - bText.length,
        });
      }
    }
  }

  return {
    runId: pipeline.originalRequest.runId,
    totalMessagesBefore: before.length,
    totalMessagesAfter: after.length,
    messagesAdded: added,
    messagesRemoved: removed,
    messagesModified: modified,
    totalCharDelta: diffs.reduce((a, d) => a + d.charDelta, 0),
    diffs: diffs.filter(d => d.changeType !== "unchanged"),
    transformsApplied: pipeline.transformsApplied,
  };
}
