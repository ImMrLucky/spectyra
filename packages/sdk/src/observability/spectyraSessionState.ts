import type { SpectyraCompleteResult } from "../types.js";
import type {
  SpectyraEntitlementStatus,
  SpectyraLastRun,
  SpectyraMetricsSnapshot,
  SpectyraSavingsSummary,
  SpectyraSessionCostSummary,
} from "./observabilityTypes.js";

/**
 * In-memory session accounting for a single `createSpectyra()` instance.
 * When `metricsFrozen` is set (e.g. quota exhausted), new runs do not add to rollups.
 */
export class SpectyraSessionState {
  requestCount = 0;
  lastRun: SpectyraLastRun | null = null;
  private totalSavings = 0;
  private totalSavingsPctSum = 0;
  private totalCostBefore = 0;
  private totalCostAfter = 0;
  private lastRequestAt: string | null = null;
  metricsFrozen = false;
  private entitlement: SpectyraEntitlementStatus | null = null;

  setEntitlement(s: SpectyraEntitlementStatus) {
    this.entitlement = s;
  }

  getEntitlement(): SpectyraEntitlementStatus | null {
    return this.entitlement;
  }

  onRequestComplete(r: SpectyraCompleteResult<unknown>) {
    if (this.metricsFrozen) {
      return;
    }
    this.lastRequestAt = new Date().toISOString();
    const rep = r.report;
    this.lastRun = {
      at: this.lastRequestAt,
      provider: rep.provider,
      model: rep.model,
      report: {
        inputTokensBefore: rep.inputTokensBefore,
        inputTokensAfter: rep.inputTokensAfter,
        outputTokens: rep.outputTokens,
        estimatedCostBefore: rep.estimatedCostBefore,
        estimatedCostAfter: rep.estimatedCostAfter,
        estimatedSavings: rep.estimatedSavings,
        estimatedSavingsPct: rep.estimatedSavingsPct,
        transformsApplied: rep.transformsApplied,
      },
    };
    this.requestCount += 1;
    this.totalSavings += rep.estimatedSavings;
    this.totalSavingsPctSum += rep.estimatedSavingsPct;
    this.totalCostBefore += rep.estimatedCostBefore;
    this.totalCostAfter += rep.estimatedCostAfter;
  }

  getSessionStats(): SpectyraMetricsSnapshot {
    return {
      requestCount: this.requestCount,
      totalEstimatedSavingsUsd: this.totalSavings,
      totalInputTokensBefore: 0,
      totalInputTokensAfter: 0,
      averageSavingsPct:
        this.requestCount > 0 ? this.totalSavingsPctSum / this.requestCount : 0,
      lastRequestAt: this.lastRequestAt,
      optimizationPaused: this.metricsFrozen,
    };
  }

  getSavingsSummary(): SpectyraSavingsSummary {
    const s = this.getSessionStats();
    return {
      requestCount: s.requestCount,
      totalEstimatedSavingsUsd: s.totalEstimatedSavingsUsd,
      averageSavingsPct: s.averageSavingsPct,
      optimizationPaused: s.optimizationPaused,
    };
  }

  getSessionCostSummary(): SpectyraSessionCostSummary {
    const s = this.getSavingsSummary();
    return {
      requestCount: s.requestCount,
      totalCostBeforeUsd: this.totalCostBefore,
      totalCostAfterUsd: this.totalCostAfter,
      totalSavingsUsd: this.totalSavings,
      averageSavingsPct: s.averageSavingsPct,
      optimizationPaused: s.optimizationPaused,
    };
  }

  getLastRun(): SpectyraLastRun | null {
    return this.lastRun;
  }
}
