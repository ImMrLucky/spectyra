/**
 * Local analytics store.
 *
 * Stores run reports and prompt comparisons on disk.
 * Nothing is uploaded to Spectyra cloud unless explicitly enabled.
 */

import { promises as fs } from "fs";
import path from "path";
import { homedir } from "os";
import type { SavingsReport, PromptComparison } from "@spectyra/core-types";

/** Canonical companion data directory (~/.spectyra/companion). */
export const COMPANION_DATA_DIR = path.join(homedir(), ".spectyra", "companion");

async function ensureDir(): Promise<void> {
  await fs.mkdir(COMPANION_DATA_DIR, { recursive: true });
}

/** JSONL of normalized SpectyraEvent (Phase 2 event spine persistence). */
export function companionEventsJsonlPath(): string {
  return path.join(COMPANION_DATA_DIR, "events.jsonl");
}

export async function saveRun(report: SavingsReport): Promise<void> {
  await ensureDir();
  const file = path.join(COMPANION_DATA_DIR, "runs.jsonl");
  await fs.appendFile(file, JSON.stringify(report) + "\n", "utf-8");
}

export async function savePromptComparison(runId: string, comparison: PromptComparison): Promise<void> {
  await ensureDir();
  const dir = path.join(COMPANION_DATA_DIR, "comparisons");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${runId}.json`), JSON.stringify(comparison, null, 2), "utf-8");
}

export async function getRuns(limit = 50): Promise<SavingsReport[]> {
  await ensureDir();
  const file = path.join(COMPANION_DATA_DIR, "runs.jsonl");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as SavingsReport);
  } catch {
    return [];
  }
}

export async function getPromptComparison(runId: string): Promise<PromptComparison | null> {
  const file = path.join(COMPANION_DATA_DIR, "comparisons", `${runId}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as PromptComparison;
  } catch {
    return null;
  }
}

function isLegacyToolSkipNote(notes: SavingsReport["notes"]): boolean {
  if (!notes?.length) return false;
  return notes.some((n) => n.includes("Tool-calling conversation:"));
}

function isToolMergeFallbackNote(notes: SavingsReport["notes"]): boolean {
  if (!notes?.length) return false;
  return notes.some((n) => n.includes("structural optimization changed message count"));
}

export async function getSavingsSummary(opts?: { sessionId?: string }): Promise<{
  totalRuns: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  /** Mean of per-run estimated savings % (can differ from aggregate when call sizes vary). */
  avgSavingsPct: number;
  /** Overall input reduction: (sum before − sum after) / sum before × 100. */
  aggregateInputReductionPct: number;
  totalTokensBefore: number;
  totalTokensAfter: number;
  /** Legacy: old runs skipped tool threads; new: tool thread where merge was unsafe. */
  runsSkippedToolThread: number;
  /** Σ feature-estimated repeated context tokens (hint). */
  totalRepeatedContextTokensHint: number;
  /** Σ feature-estimated repeated tool-output tokens (hint). */
  totalRepeatedToolTokensHint: number;
  /** Sum of completion tokens across runs (when recorded). */
  totalOutputTokens: number;
  /** Sum of message rows per request (conversation depth proxy). */
  totalMessageTurns: number;
  /** Average duplicate/repeat pattern score 0–100 (runs that have it). */
  avgDuplicatePatternPct: number;
  /** Average flow stability score 0–100 (higher = more coherent context). */
  avgFlowStabilityPct: number;
  /** Runs with a stuck-loop hint in notes. */
  stuckLoopHints: number;
}> {
  const allRuns = await getRuns(10000);
  const sid = opts?.sessionId?.trim();
  const runs = sid ? allRuns.filter((r) => r.sessionId === sid) : allRuns;
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      avgSavingsPct: 0,
      aggregateInputReductionPct: 0,
      totalTokensBefore: 0,
      totalTokensAfter: 0,
      runsSkippedToolThread: 0,
      totalOutputTokens: 0,
      totalMessageTurns: 0,
      avgDuplicatePatternPct: 0,
      avgFlowStabilityPct: 0,
      stuckLoopHints: 0,
      totalRepeatedContextTokensHint: 0,
      totalRepeatedToolTokensHint: 0,
    };
  }

  let totalTokensSaved = 0;
  let totalCostSaved = 0;
  let totalPct = 0;
  let totalTokensBefore = 0;
  let totalTokensAfter = 0;
  let runsSkippedToolThread = 0;
  let totalOutputTokens = 0;
  let totalMessageTurns = 0;
  let dupSum = 0;
  let dupCount = 0;
  let flowSum = 0;
  let flowCount = 0;
  let stuckLoopHints = 0;
  let totalRepeatedContextTokensHint = 0;
  let totalRepeatedToolTokensHint = 0;
  for (const r of runs) {
    totalTokensBefore += r.inputTokensBefore;
    totalTokensAfter += r.inputTokensAfter;
    totalTokensSaved += Math.max(0, r.inputTokensBefore - r.inputTokensAfter);
    totalCostSaved += Math.max(0, r.estimatedSavings);
    totalPct += r.estimatedSavingsPct;
    if (isLegacyToolSkipNote(r.notes) || isToolMergeFallbackNote(r.notes)) runsSkippedToolThread += 1;
    totalRepeatedContextTokensHint += typeof r.repeatedContextTokensAvoided === "number" ? r.repeatedContextTokensAvoided : 0;
    totalRepeatedToolTokensHint += typeof r.repeatedToolOutputTokensAvoided === "number" ? r.repeatedToolOutputTokensAvoided : 0;
    totalOutputTokens += typeof r.outputTokens === "number" ? r.outputTokens : 0;
    totalMessageTurns += typeof r.messageTurnCount === "number" ? r.messageTurnCount : 0;
    if (typeof r.duplicateReductionPct === "number" && r.duplicateReductionPct > 0) {
      dupSum += r.duplicateReductionPct;
      dupCount += 1;
    }
    if (typeof r.flowReductionPct === "number" && r.flowReductionPct > 0) {
      flowSum += r.flowReductionPct;
      flowCount += 1;
    }
    if (r.notes?.some((n) => n.includes("error-loop pattern"))) {
      stuckLoopHints += 1;
    }
  }

  const aggregateInputReductionPct =
    totalTokensBefore > 0 ? ((totalTokensBefore - totalTokensAfter) / totalTokensBefore) * 100 : 0;

  return {
    totalRuns: runs.length,
    totalTokensSaved,
    totalCostSaved,
    avgSavingsPct: runs.length > 0 ? totalPct / runs.length : 0,
    aggregateInputReductionPct,
    totalTokensBefore,
    totalTokensAfter,
    runsSkippedToolThread,
    totalOutputTokens,
    totalMessageTurns,
    avgDuplicatePatternPct: dupCount > 0 ? dupSum / dupCount : 0,
    avgFlowStabilityPct: flowCount > 0 ? flowSum / flowCount : 0,
    stuckLoopHints,
    totalRepeatedContextTokensHint,
    totalRepeatedToolTokensHint,
  };
}
