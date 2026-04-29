import type { SpectyraMonitorEvent } from "./monitorTypes.js";
import type { SpectyraMonitorSummary } from "./monitorTypes.js";

export function emptyMonitorSummary(): SpectyraMonitorSummary {
  return {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    actualSpendProviderUsd: 0,
    optimizedSpendSpectyraUsd: 0,
    savingsUsd: 0,
    missedSavingsUsd: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    averageCostPerRequestUsd: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    lastRequestAt: null,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

/**
 * Aggregate monitor buffer into dashboard-style summary (metadata only).
 * @public
 */
export function buildMonitorSummaryFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorSummary {
  let successCount = 0;
  let errorCount = 0;
  let actualSpendProviderUsd = 0;
  let optimizedSpendSpectyraUsd = 0;
  let savingsUsd = 0;
  let missedSavingsUsd = 0;
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const latencies: number[] = [];
  let lastRequestAt: string | null = null;

  for (const e of events) {
    if (e.success) successCount += 1;
    else errorCount += 1;
    const actual = e.actualCostUsd ?? e.estimatedCostUsd ?? 0;
    actualSpendProviderUsd += actual;
    optimizedSpendSpectyraUsd += e.optimizedCostUsd ?? (e.optimizerApplied ? actual - (e.savedUsd ?? 0) : 0);
    savingsUsd += e.savedUsd ?? 0;
    missedSavingsUsd += e.missedSavingsUsd ?? 0;
    const tot = e.totalTokens ?? (e.inputTokens ?? 0) + (e.outputTokens ?? 0);
    totalTokens += tot;
    inputTokens += e.inputTokens ?? 0;
    outputTokens += e.outputTokens ?? 0;
    latencies.push(e.latencyMs);
    if (!lastRequestAt || e.timestamp > lastRequestAt) lastRequestAt = e.timestamp;
  }

  const requestCount = events.length;
  const latSorted = [...latencies].sort((a, b) => a - b);

  return {
    requestCount,
    successCount,
    errorCount,
    actualSpendProviderUsd,
    optimizedSpendSpectyraUsd,
    savingsUsd,
    missedSavingsUsd,
    totalTokens,
    inputTokens,
    outputTokens,
    averageCostPerRequestUsd: requestCount ? actualSpendProviderUsd / requestCount : 0,
    averageLatencyMs: requestCount ? latencies.reduce((a, b) => a + b, 0) / requestCount : 0,
    p95LatencyMs: percentile(latSorted, 0.95),
    lastRequestAt,
  };
}
