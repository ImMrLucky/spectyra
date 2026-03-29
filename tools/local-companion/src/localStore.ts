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

export async function getSavingsSummary(): Promise<{
  totalRuns: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  avgSavingsPct: number;
}> {
  const runs = await getRuns(10000);
  if (runs.length === 0) return { totalRuns: 0, totalTokensSaved: 0, totalCostSaved: 0, avgSavingsPct: 0 };

  let totalTokensSaved = 0;
  let totalCostSaved = 0;
  let totalPct = 0;
  for (const r of runs) {
    totalTokensSaved += Math.max(0, r.inputTokensBefore - r.inputTokensAfter);
    totalCostSaved += Math.max(0, r.estimatedSavings);
    totalPct += r.estimatedSavingsPct;
  }

  return {
    totalRuns: runs.length,
    totalTokensSaved,
    totalCostSaved,
    avgSavingsPct: runs.length > 0 ? totalPct / runs.length : 0,
  };
}
