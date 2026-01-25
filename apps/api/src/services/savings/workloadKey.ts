import crypto from "node:crypto";
import type { PathKind } from "../optimizer/spectral/types.js";

export interface WorkloadKeyInput {
  path: PathKind;
  provider: string;
  model: string;
  scenarioId?: string;
  promptLength: number;
  taskType?: string;
}

/**
 * Bucket prompt length into categories for workload grouping.
 */
function bucketPromptLength(length: number): string {
  if (length < 500) return "0-500";
  if (length < 1500) return "500-1500";
  if (length < 4000) return "1500-4000";
  return "4000+";
}

/**
 * Compute deterministic workload key for grouping comparable runs.
 * Format: path|provider|model|scenarioOrAdHoc|bucket
 * Then hashed with SHA256 for compactness.
 */
export function computeWorkloadKey(input: WorkloadKeyInput): string {
  const { path, provider, model, scenarioId, promptLength, taskType } = input;
  
  const scenarioOrAdHoc = scenarioId || "ad_hoc";
  const bucket = bucketPromptLength(promptLength);
  const task = taskType || "";
  
  // Build key string
  const keyParts = [path, provider, model, scenarioOrAdHoc, bucket];
  if (task) keyParts.push(task);
  
  const keyString = keyParts.join("|");
  
  // Hash for compactness and determinism
  return crypto.createHash("sha256").update(keyString).digest("hex").substring(0, 32);
}

/**
 * Compute prompt hash (SHA256) for deduplication and internal tracking.
 * This is server-only and never exposed to clients.
 */
export function computePromptHash(promptFinal: any): string {
  const normalized = JSON.stringify(promptFinal, Object.keys(promptFinal).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
